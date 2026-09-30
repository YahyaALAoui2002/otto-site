// Otto — persistance des commandes à emporter, côté navigateur.
// Une seule interface, deux moteurs :
//  · « api »   : le site est servi par server/server.js → SQLite + cookie de session ;
//  · « local » : page ouverte en file:// ou sans serveur → localStorage, mêmes formes de données.
// commander.js n'appelle que window.OttoStore et ignore quel moteur tourne.

(() => {
  const KEY = 'otto.orders.v1';
  const SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
  const OPEN = ['pending', 'confirmed', 'preparing', 'ready'];
  const PREP_MINUTES = 20;
  const CLIENT_CANCEL_MINUTES = 30;
  const ACTIVE_GRACE_MINUTES = 120;
  const LOCAL_RETENTION_DAYS = 30;

  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const minutesUntil = (date, slot) => {
    const [y, m, d] = date.split('-').map(Number);
    const [h, mi] = slot.split(':').map(Number);
    return (new Date(y, m - 1, d, h, mi) - Date.now()) / 60000;
  };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((Math.random() * 16) | (c === 'x' ? 0 : 8)).toString(16)));
  const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const newRef = () => 'OT-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');

  class StoreError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }

  // ---------------------------------------------------------------- API
  const apiEngine = {
    mode: 'api',
    async call(method, url, body) {
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new StoreError(data.error || 'network', data.message || 'Le serveur ne répond pas.');
      return data;
    },
    async getProfile() { return (await this.call('GET', '/api/session')).client; },
    async getSlots(date) { return (await this.call('GET', `/api/slots?date=${date}`)).slots; },
    async createOrder(input) { return (await this.call('POST', '/api/orders', input)).order; },
    async listOrders({ days = 7 } = {}) { return this.call('GET', `/api/orders?days=${days}`); },
    async cancelOrder(id) { return (await this.call('POST', `/api/orders/${id}/cancel`)).order; },
    async listNotifications() { return (await this.call('GET', '/api/notifications')).notifications; },
    async markNotificationsRead(ids) { if (ids.length) await this.call('POST', '/api/notifications/read', { ids }); },
  };

  // -------------------------------------------------------------- local
  // Pas de serveur = pas de comptoir pour confirmer : les commandes restent « pending ».
  const localEngine = {
    mode: 'local',
    load() {
      let db;
      try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
      if (!db || !db.client) db = { client: { id: uuid(), name: null, email: null, phone: null, createdAt: new Date().toISOString() }, orders: [], notifications: [], seq: 0 };
      const cutoff = new Date(Date.now() - LOCAL_RETENTION_DAYS * 86400000).toISOString();
      db.orders = db.orders.filter((o) => o.createdAt >= cutoff || OPEN.includes(o.status));
      db.notifications = db.notifications.filter((n) => db.orders.some((o) => o.id === n.orderId));
      return db;
    },
    save(db) {
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch { throw new StoreError('storage_full', 'Impossible d’enregistrer la commande sur cet appareil.'); }
    },
    decorate(o) {
      const left = minutesUntil(o.pickup.date, o.pickup.slot);
      return { ...o, active: OPEN.includes(o.status) && left > -ACTIVE_GRACE_MINUTES,
        cancellable: ['pending', 'confirmed'].includes(o.status) && left >= CLIENT_CANCEL_MINUTES };
    },
    notify(db, o, kind, title, body) {
      db.seq += 1;
      db.notifications.unshift({ id: db.seq, orderId: o.id, orderRef: o.ref, kind, status: 'sent', title, body, createdAt: new Date().toISOString(), readAt: null });
    },
    async getProfile() { const { client } = this.load(); return client; },
    async getSlots(date) {
      return SLOTS.map((slot) => ({ slot, remaining: null, available: minutesUntil(date, slot) > PREP_MINUTES }));
    },
    async createOrder(input) {
      const db = this.load();
      const { customer = {}, items = [] } = input;
      if (!items.length) throw new StoreError('invalid_items', 'Panier vide.');
      if (!SLOTS.includes(input.pickupSlot) || minutesUntil(input.pickupDate, input.pickupSlot) <= PREP_MINUTES) {
        throw new StoreError('slot_unavailable', 'Ce créneau est passé.');
      }
      const now = new Date().toISOString();
      const lines = items.map((i) => ({ name: i.name, extras: i.extras || [], unitPriceCents: i.unitPriceCents, quantity: i.quantity, lineTotalCents: i.unitPriceCents * i.quantity }));
      const order = {
        id: uuid(), ref: newRef(), status: 'pending',
        pickup: { date: input.pickupDate, slot: input.pickupSlot },
        customer: { name: customer.name.trim(), email: customer.email.trim().toLowerCase(), phone: customer.phone.trim() },
        notes: input.notes?.trim() || null,
        items: lines, totalCents: lines.reduce((t, l) => t + l.lineTotalCents, 0), currency: 'EUR', paymentMethod: 'on_pickup',
        createdAt: now, updatedAt: now, confirmedAt: null, readyAt: null, collectedAt: null, cancelledAt: null,
      };
      db.orders.unshift(order);
      Object.assign(db.client, order.customer);
      this.notify(db, order, 'order_received', 'Commande reçue', `Commande ${order.ref} enregistrée pour le ${order.pickup.date} à ${order.pickup.slot}.`);
      this.save(db);
      return this.decorate(order);
    },
    async listOrders({ days = 7 } = {}) {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const all = this.load().orders.map((o) => this.decorate(o)).filter((o) => o.active || o.createdAt >= since);
      const bySlot = (a, b) => `${a.pickup.date} ${a.pickup.slot}`.localeCompare(`${b.pickup.date} ${b.pickup.slot}`);
      return { active: all.filter((o) => o.active).sort(bySlot), past: all.filter((o) => !o.active).sort((a, b) => bySlot(b, a)) };
    },
    async cancelOrder(id) {
      const db = this.load();
      const o = db.orders.find((x) => x.id === id);
      if (!o) throw new StoreError('not_found', 'Commande introuvable.');
      if (!this.decorate(o).cancellable) throw new StoreError('not_cancellable', 'Trop tard pour annuler en ligne — appelez-nous au 09 87 14 08 50.');
      o.status = 'cancelled';
      o.cancelledAt = o.updatedAt = new Date().toISOString();
      this.notify(db, o, 'order_cancelled', 'Commande annulée', `Votre commande ${o.ref} est annulée.`);
      this.save(db);
      return this.decorate(o);
    },
    async listNotifications() { return this.load().notifications.filter((n) => n.status === 'sent'); },
    async markNotificationsRead(ids) {
      const db = this.load();
      db.notifications.forEach((n) => { if (ids.includes(n.id) && n.status === 'sent') { n.status = 'read'; n.readAt = new Date().toISOString(); } });
      this.save(db);
    },
  };

  // Choix du moteur : l'API si le site est servi en http(s) et répond, sinon localStorage.
  let engine = null;
  async function init() {
    if (engine) return engine.mode;
    if (location.protocol.startsWith('http')) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (res.ok && (await res.json()).ok) engine = apiEngine;
      } catch { /* pas de serveur : repli local */ }
    }
    engine = engine || localEngine;
    return engine.mode;
  }
  const ready = (fn) => async (...args) => { await init(); return fn(...args); };

  window.OttoStore = {
    init,
    get mode() { return engine?.mode || null; },
    getProfile: ready(() => engine.getProfile()),
    getSlots: ready((date) => engine.getSlots(date)),
    createOrder: ready((input) => engine.createOrder(input)),
    listOrders: ready((opts) => engine.listOrders(opts)),
    cancelOrder: ready((id) => engine.cancelOrder(id)),
    listNotifications: ready(() => engine.listNotifications()),
    markNotificationsRead: ready((ids) => engine.markNotificationsRead(ids)),
    StoreError,
  };
})();
