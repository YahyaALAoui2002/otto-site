// Otto — couche de persistance (SQLite intégré à Node ≥ 22, aucune dépendance).
// Tout ce qui touche à la base passe par ce module : le serveur HTTP
// ne manipule jamais de SQL directement.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// ---- Règles de retrait (les mêmes que l'interface de commander.html) ----
const SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
const PREP_MINUTES = 20;          // délai minimum avant un créneau du jour
const MAX_DAYS_AHEAD = 60;        // on ne commande pas plus de deux mois à l'avance
const SLOT_CAPACITY = 8;          // commandes par créneau, au-delà le four sature
const CLIENT_CANCEL_MINUTES = 30; // le client peut annuler jusqu'à 30 min avant
const ACTIVE_GRACE_MINUTES = 120; // une commande reste « en cours » 2 h après son créneau
const SESSION_DAYS = 180;
const REMINDER_MINUTES = 60;      // rappel automatique une heure avant le retrait…
const REMINDER_MIN_LEAD = 45;     // …sauf si la commande a été passée moins de 45 min avant
const MAIL_MAX_ATTEMPTS = 5;      // puis l'email passe en « failed »

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'collected', 'cancelled'];
const OPEN_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];

const RESTAURANT_TZ = 'Europe/Paris';
const nowISO = () => new Date().toISOString();
const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// Date et minute courantes à Paris, quel que soit le fuseau du serveur.
function parisNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const longDate = (iso) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  .format(new Date(`${iso}T00:00:00Z`));

// Minutes restantes avant le créneau (négatif s'il est passé).
function minutesUntil(date, slot) {
  const now = parisNow();
  const dayDiff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${now.date}T00:00:00Z`)) / 86400000);
  return dayDiff * 1440 + toMinutes(slot) - now.minutes;
}
const isActive = (o) => OPEN_STATUSES.includes(o.status) && minutesUntil(o.pickup_date, o.pickup_slot) > -ACTIVE_GRACE_MINUTES;

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// ---- Ouverture + migrations ----
function open(file = process.env.OTTO_DB || path.join(__dirname, '..', 'data', 'otto.db')) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// La carte fait foi dans commander.html (data-name / data-price par catégorie) :
// on la relit au démarrage pour ne jamais avoir deux sources de prix.
function syncMenu(db, htmlFile = path.join(__dirname, '..', 'commander.html')) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
  const found = [];
  for (const block of html.split(/data-cat="/).slice(1)) {
    const category = block.slice(0, block.indexOf('"'));
    for (const m of block.matchAll(/class="order-item" data-name="([^"]+)" data-price="(\d+(?:\.\d+)?)"/g)) {
      found.push({ name: decode(m[1]), category, price_cents: Math.round(Number(m[2]) * 100) });
    }
  }
  if (!found.length) throw new Error('Carte introuvable dans commander.html');
  tx(db, () => {
    db.exec('UPDATE menu_items SET active = 0');
    const up = db.prepare(`INSERT INTO menu_items (name, category, price_cents, active) VALUES (?, ?, ?, 1)
      ON CONFLICT (name) DO UPDATE SET category = excluded.category, price_cents = excluded.price_cents, active = 1`);
    found.forEach((i) => up.run(i.name, i.category, i.price_cents));
  });
  return found.length;
}

// ---- Clients et sessions ----
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

// Retourne { client, token } — token n'est présent que s'il faut (re)poser le cookie.
function resolveSession(db, token, userAgent) {
  const now = nowISO();
  if (token) {
    const row = db.prepare(`SELECT c.* FROM sessions s JOIN clients c ON c.id = s.client_id
      WHERE s.token_hash = ? AND s.expires_at > ?`).get(hashToken(token), now);
    if (row) {
      db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(now, hashToken(token));
      db.prepare('UPDATE clients SET last_seen_at = ? WHERE id = ?').run(now, row.id);
      return { client: row, token: null };
    }
  }
  const client = { id: crypto.randomUUID(), name: null, email: null, phone: null, created_at: now, last_seen_at: now };
  const fresh = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  tx(db, () => {
    db.prepare('INSERT INTO clients (id, created_at, last_seen_at) VALUES (?, ?, ?)').run(client.id, now, now);
    db.prepare(`INSERT INTO sessions (token_hash, client_id, user_agent, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(hashToken(fresh), client.id, (userAgent || '').slice(0, 200), now, now, expires);
  });
  return { client, token: fresh };
}

const publicProfile = (c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone });

// Nettoyage : sessions expirées et clients anonymes jamais revenus ni commandé.
function purge(db) {
  const now = nowISO();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  db.prepare(`DELETE FROM clients WHERE last_seen_at < ? AND id NOT IN (SELECT client_id FROM orders)
    AND id NOT IN (SELECT client_id FROM sessions)`).run(new Date(Date.now() - 86400000).toISOString());
}

// ---- Créneaux ----
function slotAvailability(db, date) {
  const now = parisNow();
  const counts = Object.fromEntries(db.prepare(`SELECT pickup_slot, COUNT(*) AS n FROM orders
    WHERE pickup_date = ? AND status != 'cancelled' GROUP BY pickup_slot`).all(date).map((r) => [r.pickup_slot, r.n]));
  return SLOTS.map((slot) => {
    const taken = counts[slot] || 0;
    const past = date < now.date || (date === now.date && toMinutes(slot) <= now.minutes + PREP_MINUTES);
    return { slot, remaining: Math.max(0, SLOT_CAPACITY - taken), available: !past && taken < SLOT_CAPACITY };
  });
}

// ---- Commandes ----
const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const newRef = () => 'OT-' + Array.from(crypto.randomBytes(4), (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+ .()-]{8,20}$/;
const clean = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

function validateOrder(db, input) {
  const customer = input.customer || {};
  const name = clean(customer.name, 80);
  const email = clean(customer.email, 120).toLowerCase();
  const phone = clean(customer.phone, 20);
  const notes = typeof input.notes === 'string' ? input.notes.trim().slice(0, 500) : '';
  if (!name) throw new HttpError(422, 'invalid_name', 'Nom manquant.');
  if (!EMAIL_RE.test(email)) throw new HttpError(422, 'invalid_email', 'Email invalide.');
  if (!PHONE_RE.test(phone)) throw new HttpError(422, 'invalid_phone', 'Téléphone invalide.');

  const date = String(input.pickupDate || '');
  const slot = String(input.pickupSlot || '');
  const today = parisNow().date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > addDays(today, MAX_DAYS_AHEAD)) {
    throw new HttpError(422, 'invalid_date', 'Date de retrait invalide.');
  }
  const availability = slotAvailability(db, date).find((s) => s.slot === slot);
  if (!availability) throw new HttpError(422, 'invalid_slot', 'Créneau inconnu.');
  if (!availability.available) {
    throw new HttpError(409, 'slot_unavailable', availability.remaining ? 'Ce créneau est passé.' : 'Ce créneau est complet.');
  }

  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 40) {
    throw new HttpError(422, 'invalid_items', 'Panier vide.');
  }
  const menu = db.prepare('SELECT id, name, price_cents FROM menu_items WHERE name = ? AND active = 1');
  const merged = new Map();
  for (const it of input.items) {
    const item = menu.get(String(it?.name || ''));
    const qty = Number(it?.quantity);
    if (!item) throw new HttpError(422, 'unknown_item', `Plat inconnu : ${it?.name}`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 9) throw new HttpError(422, 'invalid_quantity', 'Quantité invalide.');
    const prev = merged.get(item.id);
    merged.set(item.id, { ...item, quantity: Math.min(9, (prev?.quantity || 0) + qty) });
  }
  const items = [...merged.values()].map((i) => ({ ...i, line_total_cents: i.price_cents * i.quantity }));
  return { name, email, phone, notes: notes || null, date, slot, items, total: items.reduce((t, i) => t + i.line_total_cents, 0) };
}

function createOrder(db, clientId, input) {
  const v = validateOrder(db, input);
  const now = nowISO();
  const id = crypto.randomUUID();
  return tx(db, () => {
    // Deuxième contrôle de capacité à l'intérieur de la transaction (commandes simultanées).
    if (!slotAvailability(db, v.date).find((s) => s.slot === v.slot).available) {
      throw new HttpError(409, 'slot_unavailable', 'Ce créneau vient de se remplir.');
    }
    let ref;
    do { ref = newRef(); } while (db.prepare('SELECT 1 FROM orders WHERE ref = ?').get(ref));
    db.prepare(`INSERT INTO orders (id, ref, client_id, status, pickup_date, pickup_slot, customer_name, customer_email,
      customer_phone, notes, total_cents, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, ref, clientId, v.date, v.slot, v.name, v.email, v.phone, v.notes, v.total, now, now);
    const line = db.prepare(`INSERT INTO order_items (order_id, menu_item_id, name, unit_price_cents, quantity, line_total_cents)
      VALUES (?, ?, ?, ?, ?, ?)`);
    v.items.forEach((i) => line.run(id, i.id, i.name, i.price_cents, i.quantity, i.line_total_cents));
    db.prepare('INSERT INTO order_events (order_id, status, actor, created_at) VALUES (?, ?, ?, ?)').run(id, 'pending', 'client', now);
    db.prepare('UPDATE clients SET name = ?, email = ?, phone = ?, last_seen_at = ? WHERE id = ?').run(v.name, v.email, v.phone, now, clientId);
    notify(db, getOrderRow(db, id), 'pending');
    return getOrder(db, id);
  });
}

const getOrderRow = (db, id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

function serializeOrder(db, o) {
  const items = db.prepare('SELECT name, unit_price_cents, quantity, line_total_cents FROM order_items WHERE order_id = ? ORDER BY id').all(o.id);
  return {
    id: o.id,
    ref: o.ref,
    status: o.status,
    active: isActive(o),
    cancellable: ['pending', 'confirmed'].includes(o.status) && minutesUntil(o.pickup_date, o.pickup_slot) >= CLIENT_CANCEL_MINUTES,
    pickup: { date: o.pickup_date, slot: o.pickup_slot },
    customer: { name: o.customer_name, email: o.customer_email, phone: o.customer_phone },
    notes: o.notes,
    items: items.map((i) => ({ name: i.name, unitPriceCents: i.unit_price_cents, quantity: i.quantity, lineTotalCents: i.line_total_cents })),
    totalCents: o.total_cents,
    currency: o.currency,
    paymentMethod: o.payment_method,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    confirmedAt: o.confirmed_at,
    readyAt: o.ready_at,
    collectedAt: o.collected_at,
    cancelledAt: o.cancelled_at,
  };
}
const getOrder = (db, id) => { const o = getOrderRow(db, id); return o ? serializeOrder(db, o) : null; };

function getClientOrder(db, clientId, id) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND client_id = ?').get(id, clientId);
  if (!o) throw new HttpError(404, 'not_found', 'Commande introuvable.');
  return o;
}

// Historique d'un client : tout ce qui est en cours + ce qui a été passé ces `days` derniers jours.
function listClientOrders(db, clientId, days = 7) {
  const since = new Date(Date.now() - Math.min(90, Math.max(1, days)) * 86400000).toISOString();
  const rows = db.prepare(`SELECT * FROM orders WHERE client_id = ? AND (created_at >= ? OR status IN (${OPEN_STATUSES.map(() => '?').join(',')}))
    ORDER BY pickup_date DESC, pickup_slot DESC`).all(clientId, since, ...OPEN_STATUSES);
  const orders = rows.map((o) => serializeOrder(db, o)).filter((o) => o.active || o.createdAt >= since);
  return { active: orders.filter((o) => o.active).reverse(), past: orders.filter((o) => !o.active) };
}

// ---- Statuts ----
const TIMESTAMP_COLUMN = { confirmed: 'confirmed_at', ready: 'ready_at', collected: 'collected_at', cancelled: 'cancelled_at' };

function setStatus(db, id, status, { actor, note } = {}) {
  if (!STATUSES.includes(status)) throw new HttpError(422, 'invalid_status', 'Statut inconnu.');
  return tx(db, () => {
    const o = getOrderRow(db, id);
    if (!o) throw new HttpError(404, 'not_found', 'Commande introuvable.');
    if (!OPEN_STATUSES.includes(o.status)) throw new HttpError(409, 'order_closed', 'Commande déjà clôturée.');
    // On n'avance que vers l'avant (ou vers l'annulation).
    if (status !== 'cancelled' && STATUSES.indexOf(status) <= STATUSES.indexOf(o.status)) {
      throw new HttpError(409, 'invalid_transition', `Passage ${o.status} → ${status} impossible.`);
    }
    const now = nowISO();
    const col = TIMESTAMP_COLUMN[status];
    db.prepare(`UPDATE orders SET status = ?, updated_at = ?${col ? `, ${col} = ?` : ''}${status === 'cancelled' ? ', cancel_reason = ?' : ''} WHERE id = ?`)
      .run(...[status, now, ...(col ? [now] : []), ...(status === 'cancelled' ? [note || null] : []), id]);
    db.prepare('INSERT INTO order_events (order_id, status, actor, note, created_at) VALUES (?, ?, ?, ?, ?)').run(id, status, actor, note || null, now);
    notify(db, getOrderRow(db, id), status);
    return getOrder(db, id);
  });
}

function cancelByClient(db, clientId, id) {
  const o = serializeOrder(db, getClientOrder(db, clientId, id));
  if (!o.cancellable) {
    throw new HttpError(409, 'not_cancellable', `Trop tard pour annuler en ligne — appelez-nous au 09 87 14 08 50.`);
  }
  return setStatus(db, id, 'cancelled', { actor: 'client', note: 'Annulée par le client' });
}

// ---- Notifications ----
function message(o, status) {
  const when = `${longDate(o.pickup_date)} à ${o.pickup_slot}`;
  return {
    pending: ['order_received', 'Commande reçue', `Commande ${o.ref} bien reçue pour ${when}. On vous confirme dès que le four l'a en vue.`],
    confirmed: ['order_confirmed', 'Commande confirmée', `Commande ${o.ref} confirmée — retrait ${when}, au 53 bis Bd Arago.`],
    preparing: ['order_preparing', 'Au four !', `Votre commande ${o.ref} est en préparation.`],
    ready: ['order_ready', 'Prête au comptoir', `Votre commande ${o.ref} vous attend, bien chaude, au 53 bis Bd Arago.`],
    collected: ['order_collected', 'Buon appetito !', `Merci pour votre commande ${o.ref}. À bientôt chez Otto.`],
    cancelled: ['order_cancelled', 'Commande annulée', `Votre commande ${o.ref} du ${when} est annulée.`],
    reminder: ['order_reminder', 'Rappel : retrait bientôt', `Votre commande ${o.ref} sera prête ${when}, au 53 bis Bd Arago. Paiement au retrait.`],
  }[status];
}

// Chaque changement de statut : une notification « web » (affichée sur le site)
// et un email en file d'attente (outbox, à expédier par le futur mailer).
// Retourne le nombre de notifications réellement créées (0 si le rappel existait déjà).
function notify(db, o, status) {
  const [kind, title, body] = message(o, status);
  const now = nowISO();
  const ins = db.prepare(`INSERT OR IGNORE INTO notifications (client_id, order_id, kind, channel, status, title, body, recipient, created_at, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  return Number(ins.run(o.client_id, o.id, kind, 'web', 'sent', title, body, null, now, now).changes)
    + Number(ins.run(o.client_id, o.id, kind, 'email', 'queued', title, body, o.customer_email, now, null).changes);
}

// ---- Déclencheurs automatiques (appelés par le planificateur de server.js) ----
// Rappel une heure avant le créneau pour les commandes encore ouvertes et pas encore prêtes.
function queueReminders(db) {
  const today = parisNow().date;
  const rows = db.prepare(`SELECT * FROM orders WHERE status IN ('pending', 'confirmed', 'preparing')
    AND pickup_date IN (?, ?)`).all(today, addDays(today, 1));
  let created = 0;
  for (const o of rows) {
    const left = minutesUntil(o.pickup_date, o.pickup_slot);
    const lead = (Date.now() - Date.parse(o.created_at)) / 60000 + left; // minutes entre commande et créneau
    if (left > 0 && left <= REMINDER_MINUTES && lead >= REMINDER_MIN_LEAD) created += tx(db, () => notify(db, o, 'reminder'));
  }
  return created;
}

// File d'envoi des emails : le mailer réserve un lot, puis signale succès ou échec.
function pendingEmails(db, limit = 20) {
  return db.prepare(`SELECT id, order_id AS orderId, kind, recipient, title, body, attempts FROM notifications
    WHERE channel = 'email' AND status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
    ORDER BY id LIMIT ?`).all(nowISO(), limit);
}

function markEmailSent(db, id) {
  const now = nowISO();
  db.prepare(`UPDATE notifications SET status = 'sent', sent_at = ?, attempts = attempts + 1, last_error = NULL, next_attempt_at = NULL
    WHERE id = ? AND channel = 'email'`).run(now, id);
}

// Nouvel essai après 2, 4, 8, 16 min ; au 5e échec l'email est abandonné.
function markEmailFailed(db, id, error) {
  const row = db.prepare("SELECT attempts FROM notifications WHERE id = ? AND channel = 'email'").get(id);
  if (!row) return;
  const attempts = row.attempts + 1;
  const giveUp = attempts >= MAIL_MAX_ATTEMPTS;
  db.prepare('UPDATE notifications SET status = ?, attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?').run(
    giveUp ? 'failed' : 'queued', attempts, String(error).slice(0, 500),
    giveUp ? null : new Date(Date.now() + 2 ** attempts * 60000).toISOString(), id);
}

const outboxStats = (db) => Object.fromEntries(db.prepare(`SELECT status, COUNT(*) AS n FROM notifications
  WHERE channel = 'email' GROUP BY status`).all().map((r) => [r.status, r.n]));

function listNotifications(db, clientId, { unreadOnly = true } = {}) {
  return db.prepare(`SELECT n.id, n.order_id AS orderId, o.ref AS orderRef, n.kind, n.status, n.title, n.body, n.created_at AS createdAt, n.read_at AS readAt
    FROM notifications n LEFT JOIN orders o ON o.id = n.order_id
    WHERE n.client_id = ? AND n.channel = 'web' ${unreadOnly ? "AND n.status = 'sent'" : ''}
    ORDER BY n.id DESC LIMIT 50`).all(clientId);
}

function markNotificationsRead(db, clientId, ids) {
  const now = nowISO();
  const stmt = db.prepare(`UPDATE notifications SET status = 'read', read_at = ? WHERE id = ? AND client_id = ? AND channel = 'web' AND status = 'sent'`);
  return ids.reduce((n, id) => n + Number(stmt.run(now, Number(id), clientId).changes), 0);
}

// ---- Vue comptoir (staff) ----
function listOrdersForDay(db, date) {
  return db.prepare('SELECT * FROM orders WHERE pickup_date = ? ORDER BY pickup_slot, created_at').all(date).map((o) => serializeOrder(db, o));
}

// ---- Tableau de bord du patron (/admin, lecture de toute la base) ----
// Chaque table est exposée via une vue temporaire (propre à la connexion) enrichie
// de quelques colonnes pratiques (référence de commande, nombre de plats…).
// Seuls les noms déclarés ici sont accessibles : aucun identifiant SQL ne vient de la requête.
// admin/index.html en garde une copie (TABLE_DEFS) pour la démo et les exports : modifier les deux ensemble.
const ADMIN_TABLES = {
  orders: {
    label: 'Commandes',
    // Colonnes dans l'ordre utile au comptoir : référence, statut et créneau d'abord.
    sql: `SELECT o.ref, o.status, o.pickup_date, o.pickup_slot, o.customer_name, o.customer_phone, o.customer_email,
      (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count, o.total_cents, o.notes,
      o.created_at, o.updated_at, o.confirmed_at, o.ready_at, o.collected_at, o.cancelled_at, o.cancel_reason,
      o.payment_method, o.currency, o.client_id, o.id FROM orders o`,
    sort: 'pickup_date DESC, pickup_slot DESC, created_at DESC',
    dates: ['pickup_date', 'created_at'],
    facets: { status: STATUSES },
    search: ['ref', 'customer_name', 'customer_email', 'customer_phone', 'notes', 'client_id', 'id'],
  },
  clients: {
    label: 'Clients',
    sql: `SELECT c.*, (SELECT COUNT(*) FROM orders WHERE client_id = c.id) AS order_count,
      (SELECT COALESCE(SUM(total_cents), 0) FROM orders WHERE client_id = c.id AND status != 'cancelled') AS spent_cents FROM clients c`,
    sort: 'last_seen_at DESC',
    dates: ['created_at', 'last_seen_at'],
    search: ['id', 'name', 'email', 'phone'],
  },
  sessions: {
    label: 'Sessions',
    sql: 'SELECT * FROM sessions',
    sort: 'last_seen_at DESC',
    dates: ['created_at', 'last_seen_at', 'expires_at'],
    search: ['client_id', 'user_agent'],
  },
  menu_items: {
    label: 'Carte',
    sql: `SELECT m.*, (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.menu_item_id = m.id AND o.status != 'cancelled') AS sold FROM menu_items m`,
    sort: 'category, name',
    facets: { category: null, active: null },
    search: ['name', 'category'],
  },
  order_items: {
    label: 'Lignes de commande',
    sql: 'SELECT oi.*, o.ref AS order_ref, o.pickup_date FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id',
    sort: 'id DESC',
    dates: ['pickup_date'],
    search: ['order_id', 'order_ref', 'name'],
  },
  order_events: {
    label: 'Historique des statuts',
    sql: 'SELECT e.*, o.ref AS order_ref FROM order_events e LEFT JOIN orders o ON o.id = e.order_id',
    sort: 'id DESC',
    dates: ['created_at'],
    facets: { status: STATUSES, actor: ['client', 'staff', 'system'] },
    search: ['order_id', 'order_ref', 'note'],
  },
  notifications: {
    label: 'Notifications',
    sql: 'SELECT n.*, o.ref AS order_ref FROM notifications n LEFT JOIN orders o ON o.id = n.order_id',
    sort: 'id DESC',
    dates: ['created_at'],
    facets: { channel: null, status: null, kind: null },
    search: ['order_id', 'order_ref', 'client_id', 'recipient', 'title', 'body'],
  },
  outbox: {
    label: 'File d’emails',
    sql: `SELECT n.id, n.status, n.kind, n.recipient, n.title, n.body, n.attempts, n.last_error, n.next_attempt_at,
      n.created_at, n.sent_at, n.order_id, o.ref AS order_ref FROM notifications n LEFT JOIN orders o ON o.id = n.order_id
      WHERE n.channel = 'email'`,
    sort: 'id DESC',
    dates: ['created_at'],
    facets: { status: ['queued', 'sent', 'failed'], kind: null },
    search: ['order_id', 'order_ref', 'recipient', 'title', 'last_error'],
  },
};

const adminViews = new WeakSet();
function adminView(db, name) {
  if (!adminViews.has(db)) {
    for (const [key, t] of Object.entries(ADMIN_TABLES)) db.exec(`CREATE TEMP VIEW IF NOT EXISTS admin_${key} AS ${t.sql}`);
    adminViews.add(db);
  }
  return `admin_${name}`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Une page d'une table, avec recherche plein texte, filtres (facettes), plage de dates et tri.
function browseTable(db, name, params = {}) {
  const t = Object.hasOwn(ADMIN_TABLES, name) && ADMIN_TABLES[name];
  if (!t) throw new HttpError(404, 'unknown_table', 'Table inconnue.');
  const view = adminView(db, name);
  const columns = db.prepare(`PRAGMA table_info(${view})`).all().map((c) => c.name);
  const facetNames = Object.keys(t.facets || {});
  const dates = t.dates || [];

  const where = [];
  const args = [];
  const q = String(params.q || '').trim().slice(0, 100);
  if (q) {
    where.push(`(${t.search.map((c) => `${c} LIKE ?`).join(' OR ')})`);
    args.push(...t.search.map(() => `%${q}%`));
  }
  for (const f of facetNames) {
    if (params[f] !== undefined && params[f] !== '') { where.push(`${f} = ?`); args.push(String(params[f])); }
  }
  const dateField = dates.includes(params.dateField) ? params.dateField : dates[0] || null;
  if (dateField && ISO_DAY.test(params.from || '')) { where.push(`substr(${dateField}, 1, 10) >= ?`); args.push(params.from); }
  if (dateField && ISO_DAY.test(params.to || '')) { where.push(`substr(${dateField}, 1, 10) <= ?`); args.push(params.to); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const order = columns.includes(params.sort) ? `${params.sort} ${params.dir === 'asc' ? 'ASC' : 'DESC'}` : t.sort;
  const limit = Math.min(500, Math.max(1, Number(params.limit) || 50));
  const offset = Math.max(0, Number(params.offset) || 0);

  const facets = Object.fromEntries(facetNames.map((f) => [f, t.facets[f]
    || db.prepare(`SELECT DISTINCT ${f} AS v FROM ${view} WHERE ${f} IS NOT NULL ORDER BY 1`).all().map((r) => r.v)]));

  return {
    table: name, label: t.label, columns, facets, dates, dateField,
    total: db.prepare(`SELECT COUNT(*) AS n FROM ${view} ${clause}`).get(...args).n,
    rows: db.prepare(`SELECT * FROM ${view} ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args, limit, offset),
    limit, offset,
  };
}

// Chiffres clés du jour + taille de chaque table.
function adminSummary(db) {
  const today = parisNow().date;
  const byStatus = Object.fromEntries(db.prepare(`SELECT status, COUNT(*) AS n FROM orders WHERE pickup_date = ? GROUP BY status`)
    .all(today).map((r) => [r.status, r.n]));
  const tables = Object.fromEntries(Object.entries(ADMIN_TABLES).map(([key, t]) =>
    [key, { label: t.label, count: db.prepare(`SELECT COUNT(*) AS n FROM ${adminView(db, key)}`).get().n }]));
  return {
    today,
    todayByStatus: byStatus,
    todayOrders: Object.entries(byStatus).reduce((n, [s, c]) => n + (s === 'cancelled' ? 0 : c), 0),
    todayRevenueCents: db.prepare(`SELECT COALESCE(SUM(total_cents), 0) AS c FROM orders WHERE pickup_date = ? AND status != 'cancelled'`).get(today).c,
    openOrders: db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE pickup_date >= ? AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})`)
      .get(today, ...OPEN_STATUSES).n,
    outbox: outboxStats(db),
    tables,
  };
}

// Fiche complète d'une commande : lignes, historique, notifications, client.
function adminOrderDetail(db, id) {
  const o = getOrderRow(db, id);
  if (!o) throw new HttpError(404, 'not_found', 'Commande introuvable.');
  return {
    order: { ...serializeOrder(db, o), clientId: o.client_id, cancelReason: o.cancel_reason },
    events: db.prepare('SELECT status, actor, note, created_at AS createdAt FROM order_events WHERE order_id = ? ORDER BY id').all(id),
    notifications: db.prepare(`SELECT id, kind, channel, status, recipient, attempts, last_error AS lastError,
      created_at AS createdAt, sent_at AS sentAt, read_at AS readAt FROM notifications WHERE order_id = ? ORDER BY id`).all(id),
    client: db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM orders WHERE client_id = c.id) AS order_count FROM clients c WHERE id = ?`)
      .get(o.client_id) || null,
  };
}

// Copie brute de toute la base, à rouvrir hors ligne dans admin/index.html (bouton « Ouvrir un export »).
const EXPORT_TABLES = ['menu_items', 'clients', 'sessions', 'orders', 'order_items', 'order_events', 'notifications'];
function exportAll(db) {
  return {
    format: 'otto-export',
    version: 1,
    exportedAt: nowISO(),
    tables: Object.fromEntries(EXPORT_TABLES.map((t) => [t, db.prepare(`SELECT * FROM ${t}`).all()])),
  };
}

module.exports = {
  SLOTS, STATUSES, HttpError, parisNow,
  open, syncMenu, purge,
  resolveSession, publicProfile,
  slotAvailability, createOrder, getClientOrder, serializeOrder, listClientOrders, cancelByClient, setStatus, listOrdersForDay,
  listNotifications, markNotificationsRead,
  queueReminders, pendingEmails, markEmailSent, markEmailFailed, outboxStats,
  browseTable, adminSummary, adminOrderDetail, exportAll,
};
