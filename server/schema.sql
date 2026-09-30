-- Otto — base de données des commandes à emporter (SQLite).
-- Appliqué à chaque démarrage : toutes les instructions sont idempotentes.
-- Montants en centimes, dates de retrait en heure locale de Paris.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Un « client » = un navigateur reconnu par son cookie de session.
-- Les coordonnées sont celles de sa dernière commande (pré-remplissage).
CREATE TABLE IF NOT EXISTS clients (
  id            TEXT PRIMARY KEY,                -- UUID
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  created_at    TEXT NOT NULL,                   -- ISO 8601 UTC
  last_seen_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS clients_email ON clients (email);

-- Sessions : le cookie « otto_session » porte un jeton aléatoire,
-- seule son empreinte SHA-256 est stockée.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash    TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  user_agent    TEXT,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_client ON sessions (client_id);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires_at);

-- La carte, resynchronisée depuis commander.html au démarrage :
-- le serveur recalcule toujours les prix, jamais ceux envoyés par le navigateur.
CREATE TABLE IF NOT EXISTS menu_items (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL,
  price_cents   INTEGER NOT NULL CHECK (price_cents >= 0),
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,              -- UUID
  ref             TEXT NOT NULL UNIQUE,          -- code court donné au client : « OT-7K3Q »
  client_id       TEXT NOT NULL REFERENCES clients (id),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'collected', 'cancelled')),
  pickup_date     TEXT NOT NULL,                 -- YYYY-MM-DD, heure de Paris
  pickup_slot     TEXT NOT NULL,                 -- HH:MM
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  notes           TEXT,
  total_cents     INTEGER NOT NULL CHECK (total_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'EUR',
  payment_method  TEXT NOT NULL DEFAULT 'on_pickup',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  confirmed_at    TEXT,
  ready_at        TEXT,
  collected_at    TEXT,
  cancelled_at    TEXT,
  cancel_reason   TEXT
);
CREATE INDEX IF NOT EXISTS orders_client_created ON orders (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_pickup ON orders (pickup_date, pickup_slot);
CREATE INDEX IF NOT EXISTS orders_status ON orders (status);

-- Lignes de commande : nom et prix figés au moment de la commande.
CREATE TABLE IF NOT EXISTS order_items (
  id                INTEGER PRIMARY KEY,
  order_id          TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  menu_item_id      INTEGER REFERENCES menu_items (id),
  name              TEXT NOT NULL,
  unit_price_cents  INTEGER NOT NULL,
  quantity          INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 9),
  line_total_cents  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items (order_id);

-- Historique des statuts (qui a fait quoi, quand).
CREATE TABLE IF NOT EXISTS order_events (
  id          INTEGER PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  actor       TEXT NOT NULL CHECK (actor IN ('client', 'staff', 'system')),
  note        TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS order_events_order ON order_events (order_id, created_at);

-- Notifications : « web » s'affiche sur le site (sent → read),
-- « email » est une file d'envoi (queued → sent | failed) vidée par server/mailer.js :
-- en cas d'échec, nouvel essai différé (next_attempt_at) jusqu'à 5 tentatives.
CREATE TABLE IF NOT EXISTS notifications (
  id               INTEGER PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  order_id         TEXT REFERENCES orders (id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('order_received', 'order_confirmed', 'order_preparing',
                                                 'order_ready', 'order_collected', 'order_cancelled',
                                                 'order_reminder')),
  channel          TEXT NOT NULL CHECK (channel IN ('web', 'email', 'sms')),
  status           TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'read')),
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  recipient        TEXT,
  created_at       TEXT NOT NULL,
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  next_attempt_at  TEXT,                         -- NULL = dès que possible
  sent_at          TEXT,
  read_at          TEXT
);
CREATE INDEX IF NOT EXISTS notifications_client ON notifications (client_id, channel, status);
CREATE INDEX IF NOT EXISTS notifications_outbox ON notifications (channel, status, next_attempt_at);
-- Rappel automatique avant le retrait : un seul par commande et par canal.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_reminder_once ON notifications (order_id, channel)
  WHERE kind = 'order_reminder';
