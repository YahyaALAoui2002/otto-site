// Otto — expédition de la file d'emails (notifications channel = 'email').
// Deux transports, choisis par l'environnement :
//  · OTTO_MAIL_WEBHOOK=https://…  → POST JSON { to, subject, text, tag } (Bearer $OTTO_MAIL_TOKEN si défini),
//    à brancher sur le service d'envoi retenu (Brevo, Resend, Make…) ;
//  · sinon « log » : chaque email est ajouté à data/outbox.log (développement, rien ne part).

const fs = require('node:fs');
const path = require('node:path');
const store = require('./db');

const WEBHOOK = process.env.OTTO_MAIL_WEBHOOK || '';
const WEBHOOK_TOKEN = process.env.OTTO_MAIL_TOKEN || '';
const LOG_FILE = process.env.OTTO_MAIL_LOG || path.join(__dirname, '..', 'data', 'outbox.log');

const transports = {
  async webhook(mail) {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(WEBHOOK_TOKEN ? { Authorization: `Bearer ${WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify(mail),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },
  async log(mail) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()}  → ${mail.to}  [${mail.tag}]  ${mail.subject}\n    ${mail.text}\n`);
  },
};
const mode = WEBHOOK ? 'webhook' : 'log';

// Vide la file (un lot à la fois) ; un seul passage en cours à la fois.
let running = false;
async function flush(db, send = transports[mode]) {
  if (running) return { sent: 0, failed: 0 };
  running = true;
  const result = { sent: 0, failed: 0 };
  try {
    for (const n of store.pendingEmails(db)) {
      try {
        await send({ to: n.recipient, subject: `Otto — ${n.title}`, text: n.body, tag: n.kind });
        store.markEmailSent(db, n.id);
        result.sent += 1;
      } catch (e) {
        store.markEmailFailed(db, n.id, e.message || e);
        result.failed += 1;
      }
    }
  } finally {
    running = false;
  }
  return result;
}

module.exports = { mode, flush, transports };
