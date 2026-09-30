// Otto — tests de la couche de persistance (`npm test`), sur une base en mémoire.
const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('./db');
const mailer = require('./mailer');
const crypto = require('node:crypto');

function freshDb() {
  const db = store.open(':memory:');
  store.syncMenu(db);
  return db;
}
const tomorrow = () => { const d = new Date(`${store.parisNow().date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const firstItem = (db) => db.prepare('SELECT name, price_cents FROM menu_items WHERE active = 1 ORDER BY id LIMIT 1').get();
const orderInput = (db, extra = {}) => ({
  items: [{ name: firstItem(db).name, quantity: 2 }],
  pickupDate: tomorrow(), pickupSlot: '19:30',
  customer: { name: 'Camille Test', email: 'Camille@Example.com', phone: '06 12 34 56 78' },
  ...extra,
});

test('carte synchronisée depuis commander.html', () => {
  const db = freshDb();
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM menu_items WHERE active = 1').get().n > 10);
});

test('session : cookie créé une fois puis reconnu', () => {
  const db = freshDb();
  const first = store.resolveSession(db, null, 'test-agent');
  assert.ok(first.token);
  const again = store.resolveSession(db, first.token, 'test-agent');
  assert.equal(again.token, null);
  assert.equal(again.client.id, first.client.id);
  const stored = db.prepare('SELECT token_hash FROM sessions').get().token_hash;
  assert.notEqual(stored, first.token, 'seule l’empreinte du jeton est stockée');
  const forged = store.resolveSession(db, 'faux-jeton', 'x');
  assert.notEqual(forged.client.id, first.client.id);
});

test('commande : prix recalculés côté serveur, profil pré-rempli, historique', () => {
  const db = freshDb();
  const { client } = store.resolveSession(db, null, 'ua');
  const order = store.createOrder(db, client.id, { ...orderInput(db), items: [{ name: firstItem(db).name, quantity: 2, unitPriceCents: 1 }] });
  assert.match(order.ref, /^OT-[2-9A-Z]{4}$/);
  assert.equal(order.totalCents, firstItem(db).price_cents * 2);
  assert.equal(order.customer.email, 'camille@example.com');
  const profile = db.prepare('SELECT name, email FROM clients WHERE id = ?').get(client.id);
  assert.equal(profile.email, 'camille@example.com');
  const history = store.listClientOrders(db, client.id);
  assert.equal(history.active.length, 1);
  assert.equal(history.active[0].id, order.id);
  // Un autre client ne voit pas la commande.
  const other = store.resolveSession(db, null, 'ua').client;
  assert.throws(() => store.getClientOrder(db, other.id, order.id), { code: 'not_found' });
});

test('statuts : notifications web + email à chaque étape, transitions contrôlées', () => {
  const db = freshDb();
  const { client } = store.resolveSession(db, null, 'ua');
  const order = store.createOrder(db, client.id, orderInput(db));
  store.setStatus(db, order.id, 'confirmed', { actor: 'staff' });
  store.setStatus(db, order.id, 'ready', { actor: 'staff' });
  assert.throws(() => store.setStatus(db, order.id, 'confirmed', { actor: 'staff' }), { code: 'invalid_transition' });
  const web = store.listNotifications(db, client.id);
  assert.deepEqual(web.map((n) => n.kind), ['order_ready', 'order_confirmed', 'order_received']);
  assert.equal(store.outboxStats(db).queued, 3);
  assert.equal(store.markNotificationsRead(db, client.id, web.map((n) => n.id)), 3);
  assert.equal(store.listNotifications(db, client.id).length, 0);
  const events = db.prepare('SELECT status FROM order_events WHERE order_id = ? ORDER BY id').all(order.id).map((e) => e.status);
  assert.deepEqual(events, ['pending', 'confirmed', 'ready']);
});

test('créneau complet refusé', () => {
  const db = freshDb();
  const { client } = store.resolveSession(db, null, 'ua');
  for (let i = 0; i < 8; i++) store.createOrder(db, client.id, orderInput(db));
  assert.throws(() => store.createOrder(db, client.id, orderInput(db)), { code: 'slot_unavailable' });
});

test('rappel automatique : une heure avant, une seule fois', () => {
  const db = freshDb();
  const { client } = store.resolveSession(db, null, 'ua');
  const order = store.createOrder(db, client.id, orderInput(db));
  assert.equal(store.queueReminders(db), 0, 'trop tôt pour un rappel');
  // On ramène le créneau à ~40 min d'ici, commande passée il y a 3 h.
  const now = new Date(Date.now() + 40 * 60000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]));
  db.prepare('UPDATE orders SET pickup_date = ?, pickup_slot = ?, created_at = ? WHERE id = ?').run(
    `${parts.year}-${parts.month}-${parts.day}`, `${parts.hour}:${parts.minute}`, new Date(Date.now() - 3 * 3600000).toISOString(), order.id);
  assert.equal(store.queueReminders(db), 2, 'web + email');
  assert.equal(store.queueReminders(db), 0, 'pas de doublon');
  assert.equal(store.listNotifications(db, client.id)[0].kind, 'order_reminder');
});

test('mailer : envoi, nouvel essai différé puis abandon', async () => {
  const db = freshDb();
  const { client } = store.resolveSession(db, null, 'ua');
  store.createOrder(db, client.id, orderInput(db));
  const sent = [];
  assert.deepEqual(await mailer.flush(db, async (m) => sent.push(m)), { sent: 1, failed: 0 });
  assert.equal(sent[0].to, 'camille@example.com');
  assert.match(sent[0].subject, /Commande reçue/);

  store.createOrder(db, client.id, orderInput(db));
  const boom = async () => { throw new Error('SMTP down'); };
  assert.deepEqual(await mailer.flush(db, boom), { sent: 0, failed: 1 });
  assert.deepEqual(await mailer.flush(db, boom), { sent: 0, failed: 0 }, 'attend le délai avant de réessayer');
  const row = db.prepare("SELECT * FROM notifications WHERE channel = 'email' AND status = 'queued'").get();
  assert.equal(row.attempts, 1);
  assert.equal(row.last_error, 'SMTP down');
  for (let i = 0; i < 4; i++) {
    db.prepare('UPDATE notifications SET next_attempt_at = NULL WHERE id = ?').run(row.id);
    await mailer.flush(db, boom);
  }
  assert.deepEqual(store.outboxStats(db), { sent: 1, failed: 1 });
});

test('tableau de bord : toutes les tables, filtres, tri et fiche commande', () => {
  const db = freshDb();
  const { client } = store.resolveSession(db, null, 'ua');
  const a = store.createOrder(db, client.id, orderInput(db));
  const b = store.createOrder(db, client.id, orderInput(db, { pickupSlot: '20:00' }));
  store.setStatus(db, b.id, 'confirmed', { actor: 'staff' });

  for (const t of ['orders', 'clients', 'sessions', 'menu_items', 'order_items', 'order_events', 'notifications', 'outbox']) {
    const page = store.browseTable(db, t);
    assert.ok(page.columns.length && page.total >= 1, t);
  }
  assert.throws(() => store.browseTable(db, 'sqlite_master'), { code: 'unknown_table' });
  assert.throws(() => store.browseTable(db, 'constructor'), { code: 'unknown_table' });

  assert.deepEqual(store.browseTable(db, 'orders', { status: 'confirmed' }).rows.map((o) => o.id), [b.id]);
  assert.equal(store.browseTable(db, 'orders', { from: tomorrow(), to: tomorrow() }).total, 2);
  assert.equal(store.browseTable(db, 'orders', { to: store.parisNow().date }).total, 0);
  assert.equal(store.browseTable(db, 'orders', { q: a.ref }).rows[0].id, a.id);
  assert.equal(store.browseTable(db, 'orders', { sort: 'pickup_slot', dir: 'asc' }).rows[0].id, a.id);
  // Un tri inconnu est ignoré (pas d'injection SQL via ?sort=).
  assert.equal(store.browseTable(db, 'orders', { sort: 'id; DROP TABLE orders' }).total, 2);
  assert.equal(store.browseTable(db, 'outbox').total, 3);
  assert.ok(store.browseTable(db, 'outbox').rows.every((n) => n.order_ref));
  assert.equal(store.browseTable(db, 'menu_items', { active: '1' }).total, store.browseTable(db, 'menu_items').total);
  assert.equal(store.browseTable(db, 'orders', { limit: 1, offset: 1 }).rows.length, 1);

  const detail = store.adminOrderDetail(db, b.id);
  assert.deepEqual(detail.events.map((e) => e.status), ['pending', 'confirmed']);
  assert.equal(detail.notifications.length, 4);
  assert.equal(detail.client.order_count, 2);
  assert.throws(() => store.adminOrderDetail(db, crypto.randomUUID()), { code: 'not_found' });

  const summary = store.adminSummary(db);
  assert.equal(summary.openOrders, 2);
  assert.equal(summary.tables.orders.count, 2);
  assert.equal(summary.outbox.queued, 3);
});

test('export : toutes les tables brutes, au format relu par admin/index.html', () => {
  const db = freshDb();
  const { client } = store.resolveSession(db, null, 'ua');
  store.createOrder(db, client.id, orderInput(db));
  const dump = JSON.parse(JSON.stringify(store.exportAll(db)));
  assert.equal(dump.format, 'otto-export');
  assert.deepEqual(Object.keys(dump.tables), ['menu_items', 'clients', 'sessions', 'orders', 'order_items', 'order_events', 'notifications']);
  assert.equal(dump.tables.orders.length, 1);
  assert.equal(dump.tables.notifications.length, 2);
});
