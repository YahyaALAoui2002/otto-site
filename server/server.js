// Otto — serveur du site + API des commandes à emporter.
// `npm start` puis http://localhost:3000/commander.html
//
// API client (cookie de session « otto_session », posé automatiquement) :
//   GET  /api/health
//   GET  /api/session                       → profil du client (pré-remplissage)
//   GET  /api/slots?date=YYYY-MM-DD         → créneaux + places restantes
//   POST /api/orders                        → { items:[{name,quantity,extras?}], pickupDate, pickupSlot, customer:{name,email,phone}, notes }
//   GET  /api/orders?days=7                 → { active:[…], past:[…] }
//   GET  /api/orders/:id
//   POST /api/orders/:id/cancel
//   GET  /api/notifications?all=1           → notifications site (non lues par défaut)
//   POST /api/notifications/read            → { ids:[…] }
// Tableau de bord du patron : http://localhost:3000/admin (ou /dashboard), code = $OTTO_ADMIN_TOKEN.
// Le même fichier (admin/index.html) s'ouvre aussi en double-clic : démo, export hors ligne, ou connexion à ce serveur.
// API comptoir (en-tête Authorization: Bearer $OTTO_ADMIN_TOKEN) :
//   GET   /api/admin/orders?date=YYYY-MM-DD
//   GET   /api/admin/orders/:id             → fiche complète (lignes, historique, notifications, client)
//   PATCH /api/admin/orders/:id             → { status, note }
//   GET   /api/admin/outbox                 → état de la file d'emails ({ queued, sent, failed })
//   GET   /api/admin/summary                → chiffres du jour + taille des tables
//   GET   /api/admin/export                 → copie JSON de toute la base (à rouvrir hors ligne)
//   GET   /api/admin/tables/:name?q=&from=&to=&dateField=&status=…&sort=&dir=&limit=&offset=
//         tables : orders, clients, sessions, menu_items, order_items, order_events, notifications, outbox
//   20 codes erronés en 10 min depuis une même IP → accès comptoir bloqué 10 min (429).
//
// Planificateur (toutes les minutes) : rappels automatiques 1 h avant le retrait,
// puis expédition des emails en file (voir server/mailer.js).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const store = require('./db');
const mailer = require('./mailer');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, '..');
const ADMIN_TOKEN = process.env.OTTO_ADMIN_TOKEN || '';
const SECURE_COOKIE = process.env.OTTO_SECURE_COOKIE === '1';
const COOKIE = 'otto_session';

const db = store.open();
console.log(`Carte synchronisée : ${store.syncMenu(db)} plats.`);
store.purge(db);
setInterval(() => store.purge(db), 6 * 3600 * 1000).unref();

async function tick() {
  try {
    store.queueReminders(db);
    const { sent, failed } = await mailer.flush(db);
    if (sent || failed) console.log(`Emails : ${sent} envoyé(s), ${failed} en échec (transport ${mailer.mode}).`);
  } catch (e) {
    console.error('Planificateur :', e);
  }
}
tick();
setInterval(tick, 60 * 1000).unref();

// ---- Petits utilitaires HTTP ----
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const parseCookies = (h = '') => Object.fromEntries(h.split(';').map((c) => c.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));

function readJSON(req) {
  // Exiger du JSON bloque les formulaires cross-site (en plus de SameSite=Lax).
  if (!/^application\/json\b/.test(req.headers['content-type'] || '')) {
    return Promise.reject(new store.HttpError(415, 'json_required', 'Content-Type application/json attendu.'));
  }
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 32 * 1024) { reject(new store.HttpError(413, 'too_large', 'Requête trop volumineuse.')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new store.HttpError(400, 'bad_json', 'JSON invalide.')); }
    });
    req.on('error', reject);
  });
}

// Anti-abus minimal : 10 commandes / 10 min / adresse IP.
const hits = new Map();
function countHits(key, windowMs, record = true) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (record) recent.push(now);
  if (recent.length) hits.set(key, recent); else hits.delete(key);
  return recent.length;
}
function rateLimit(ip, limit = 10, windowMs = 600000) {
  if (countHits(ip, windowMs) > limit) throw new store.HttpError(429, 'rate_limited', 'Trop de commandes, réessayez dans quelques minutes.');
}

function isAdmin(req) {
  const given = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
  const expected = Buffer.from(ADMIN_TOKEN);
  return ADMIN_TOKEN && given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// ---- Routes API ----
async function api(req, res, url) {
  const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;
  const idMatch = url.pathname.match(/^\/api\/(?:admin\/)?orders\/([0-9a-f-]{36})(\/cancel)?$/);

  if (route === 'GET /api/health') return send(res, 200, { ok: true });

  if (url.pathname.startsWith('/api/admin/')) {
    // Le tableau de bord ouvert en double-clic (file://) appelle l'API depuis une autre origine.
    // Sans risque : l'accès repose sur l'en-tête Authorization, qu'un navigateur n'envoie jamais tout seul.
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      return send(res, 204, undefined, { 'Access-Control-Allow-Methods': 'GET, PATCH', 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Max-Age': '600' });
    }
    // Seuls les codes erronés comptent ; pendant un blocage, même le bon code est refusé (anti force brute).
    const guard = `admin:${req.socket.remoteAddress}`;
    if (countHits(guard, 600000, false) >= 20) throw new store.HttpError(429, 'rate_limited', 'Trop de codes erronés, réessayez dans 10 minutes.');
    if (!isAdmin(req)) {
      if (!ADMIN_TOKEN) throw new store.HttpError(403, 'admin_disabled', 'OTTO_ADMIN_TOKEN n’est pas défini sur le serveur.');
      countHits(guard, 600000);
      throw new store.HttpError(401, 'unauthorized', 'Accès comptoir refusé.');
    }
    if (route === 'GET /api/admin/orders') {
      return send(res, 200, { orders: store.listOrdersForDay(db, url.searchParams.get('date') || store.parisNow().date) });
    }
    if (route === 'GET /api/admin/outbox') return send(res, 200, { transport: mailer.mode, emails: store.outboxStats(db) });
    if (route === 'GET /api/admin/summary') return send(res, 200, { transport: mailer.mode, ...store.adminSummary(db) });
    if (route === 'GET /api/admin/export') {
      return send(res, 200, store.exportAll(db), { 'Content-Disposition': `attachment; filename="otto-export-${store.parisNow().date}.json"` });
    }
    const table = route.match(/^GET \/api\/admin\/tables\/([a-z_]+)$/);
    if (table) return send(res, 200, store.browseTable(db, table[1], Object.fromEntries(url.searchParams)));
    if (req.method === 'GET' && idMatch && !idMatch[2]) return send(res, 200, store.adminOrderDetail(db, idMatch[1]));
    if (req.method === 'PATCH' && idMatch && !idMatch[2]) {
      const body = await readJSON(req);
      const order = store.setStatus(db, idMatch[1], String(body.status), { actor: 'staff', note: body.note });
      mailer.flush(db).catch((e) => console.error('Mailer :', e)); // le client est prévenu sans attendre la minute
      return send(res, 200, { order });
    }
    throw new store.HttpError(404, 'not_found', 'Route inconnue.');
  }

  // Toutes les routes client ont besoin de la session (créée au premier passage).
  const { client, token } = store.resolveSession(db, parseCookies(req.headers.cookie)[COOKIE], req.headers['user-agent']);
  if (token) {
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${180 * 86400}${SECURE_COOKIE ? '; Secure' : ''}`);
  }

  if (route === 'GET /api/session') return send(res, 200, { client: store.publicProfile(client) });
  if (route === 'GET /api/slots') {
    const date = url.searchParams.get('date') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new store.HttpError(422, 'invalid_date', 'Date invalide.');
    return send(res, 200, { date, slots: store.slotAvailability(db, date) });
  }
  if (route === 'POST /api/orders') {
    rateLimit(req.socket.remoteAddress);
    const order = store.createOrder(db, client.id, await readJSON(req));
    mailer.flush(db).catch((e) => console.error('Mailer :', e));
    return send(res, 201, { order });
  }
  if (route === 'GET /api/orders') {
    return send(res, 200, store.listClientOrders(db, client.id, Number(url.searchParams.get('days')) || 7));
  }
  if (idMatch && req.method === 'GET' && !idMatch[2]) {
    return send(res, 200, { order: store.serializeOrder(db, store.getClientOrder(db, client.id, idMatch[1])) });
  }
  if (idMatch && req.method === 'POST' && idMatch[2]) {
    return send(res, 200, { order: store.cancelByClient(db, client.id, idMatch[1]) });
  }
  if (route === 'GET /api/notifications') {
    return send(res, 200, { notifications: store.listNotifications(db, client.id, { unreadOnly: !url.searchParams.get('all') }) });
  }
  if (route === 'POST /api/notifications/read') {
    const { ids } = await readJSON(req);
    return send(res, 200, { updated: store.markNotificationsRead(db, client.id, Array.isArray(ids) ? ids.slice(0, 100) : []) });
  }
  throw new store.HttpError(404, 'not_found', 'Route inconnue.');
}

// ---- Tableau de bord (/admin, /dashboard) ----
// La page ne contient aucune donnée réelle : tout passe ensuite par /api/admin/*, protégé par le code.
const ADMIN_PAGE = path.join(ROOT, 'admin', 'index.html');
const ADMIN_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; "
    + "img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
function serveAdmin(req, res) {
  fs.readFile(ADMIN_PAGE, (err, html) => {
    if (err) return send(res, 500, { error: 'server_error' });
    res.writeHead(200, ADMIN_HEADERS);
    res.end(req.method === 'HEAD' ? undefined : html);
  });
}

// ---- Fichiers statiques (le site tel quel) ----
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };
const PRIVATE = /^\/(server|data|node_modules|\.git)(\/|$)|\/\./;

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) || PRIVATE.test(rel.replace(/\\/g, '/'))) return send(res, 404, { error: 'not_found' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'not_found' });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (/^\/(admin|dashboard)(\/|\/index\.html)?$/.test(url.pathname)) return serveAdmin(req, res);
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
  try {
    await api(req, res, url);
  } catch (e) {
    if (e instanceof store.HttpError) return send(res, e.status, { error: e.code, message: e.message });
    console.error(e);
    send(res, 500, { error: 'server_error', message: 'Erreur interne.' });
  }
}).listen(PORT, () => {
  console.log(`Otto → http://localhost:${PORT}/commander.html`);
  console.log(`Tableau de bord → http://localhost:${PORT}/admin${ADMIN_TOKEN ? '' : '  (désactivé : définir OTTO_ADMIN_TOKEN)'}`);
});
