// Otto — commande à emporter, en trois étapes :
// 1. le panier, 2. le retrait (jour + heure), 3. les coordonnées.
// (La réservation de table vit sur reservation.html.)
// La commande est enregistrée via window.OttoStore (order-store.js) :
// SQLite derrière /api quand le site est servi par server/server.js,
// localStorage sinon. Un client qui revient retrouve ses commandes en haut de page.

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('order-form');
  if (!form) return;

  const MAX_QTY = 9;
  const DAYS_SHOWN = 14;
  const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const store = window.OttoStore || null;

  const daysEl = document.getElementById('resa-days');
  const dateInput = document.getElementById('resa-date-input');
  const summary = document.getElementById('order-summary');
  const toast = document.getElementById('resa-toast');
  const itemsError = form.querySelector('[data-error-for="items"]');
  const timeError = form.querySelector('[data-error-for="time"]');
  const panels = [...form.querySelectorAll('.order-panel')];
  const stepItems = [...form.querySelectorAll('.order-steps-item')];
  const $ = (id) => document.getElementById(id);

  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateInput.min = toISO(today);

  const state = { date: toISO(today), cart: new Map(), step: 1 };

  // ---- Panier ----
  const items = [...form.querySelectorAll('.order-item')];
  const priceOf = (name) => Number(items.find((li) => li.dataset.name === name).dataset.price);
  const cartCount = () => [...state.cart.values()].reduce((n, q) => n + q, 0);
  const cartTotal = () => [...state.cart].reduce((t, [name, q]) => t + q * priceOf(name), 0);
  const pickedTime = () => form.querySelector('input[name="time"]:checked');
  const articles = (n) => `${n} ${n > 1 ? 'articles' : 'article'}`;

  const renderItem = (li) => {
    const qty = state.cart.get(li.dataset.name) || 0;
    li.querySelector('.order-qty-val').textContent = qty;
    const [minus, plus] = li.querySelectorAll('.order-qty-btn');
    minus.disabled = qty <= 0;
    plus.disabled = qty >= MAX_QTY;
    li.classList.toggle('is-picked', qty > 0);
  };

  items.forEach((li) => {
    li.querySelectorAll('.order-qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = li.dataset.name;
        const qty = Math.max(0, Math.min(MAX_QTY, (state.cart.get(name) || 0) + Number(btn.dataset.step)));
        if (qty) state.cart.set(name, qty); else state.cart.delete(name);
        renderItem(li);
        if (cartCount()) itemsError.hidden = true;
        refreshTabCounts();
        refreshSummary();
      });
    });
  });

  // ---- Onglets de catégories (Pizze, Entrées, Pasta, Dolci, Boissons) ----
  const tabs = [...form.querySelectorAll('.order-tab')];
  const selectTab = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab)));
  form.querySelector('.order-tabs')?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next);
    next.focus();
    e.preventDefault();
  });

  // Pastille « n » sur chaque onglet : ce qui est déjà dans le panier.
  function refreshTabCounts() {
    form.querySelectorAll('.order-cat').forEach((cat) => {
      const n = [...cat.querySelectorAll('.order-item')].reduce((s, li) => s + (state.cart.get(li.dataset.name) || 0), 0);
      const badge = form.querySelector(`[data-count-for="${cat.dataset.cat}"]`);
      badge.textContent = n;
      badge.hidden = n === 0;
    });
  }

  // ---- Bandeau des 14 prochains jours ----
  for (let i = 0; i < DAYS_SHOWN; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'resa-day';
    btn.setAttribute('role', 'radio');
    btn.dataset.date = toISO(d);
    btn.setAttribute('aria-label', longDate.format(d));
    btn.innerHTML = `<span class="resa-day-name">${i === 0 ? 'Auj.' : DAY_NAMES[d.getDay()]}</span>`
      + `<span class="resa-day-num">${d.getDate()}</span>`
      + `<span class="resa-day-month">${MONTHS[d.getMonth()]}</span>`;
    daysEl.appendChild(btn);
  }

  const setDate = (iso) => {
    state.date = iso;
    dateInput.value = iso;
    daysEl.querySelectorAll('.resa-day').forEach((b) => {
      const on = b.dataset.date === iso;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    dateInput.classList.toggle('is-active', !daysEl.querySelector(`[data-date="${iso}"]`));
    refreshSlots();
    refreshSummary();
  };

  daysEl.addEventListener('click', (e) => {
    const b = e.target.closest('.resa-day');
    if (b) setDate(b.dataset.date);
  });
  daysEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const days = [...daysEl.querySelectorAll('.resa-day')];
    const i = days.findIndex((b) => b.dataset.date === state.date);
    const next = days[Math.max(0, Math.min(days.length - 1, (i < 0 ? 0 : i) + (e.key === 'ArrowRight' ? 1 : -1)))];
    setDate(next.dataset.date);
    next.focus();
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    e.preventDefault();
  });
  dateInput.addEventListener('change', () => {
    if (dateInput.value && dateInput.value >= toISO(today)) setDate(dateInput.value);
    else dateInput.value = state.date;
  });

  // ---- Heures de retrait : il faut ~20 min de préparation ----
  // Côté serveur, un créneau peut aussi être complet : on le grise dès que la réponse arrive.
  function refreshSlots() {
    const now = new Date();
    const isToday = state.date === toISO(today);
    const disable = (input, off, full = false) => {
      input.disabled = off;
      input.closest('.resa-slot').classList.toggle('is-full', full);
      if (off && input.checked) { input.checked = false; refreshSummary(); }
    };
    form.querySelectorAll('input[name="time"]').forEach((input) => {
      const [h, m] = input.value.split(':').map(Number);
      disable(input, isToday && (h * 60 + m) <= (now.getHours() * 60 + now.getMinutes() + 20));
    });
    if (store?.mode !== 'api') return;
    const date = state.date;
    store.getSlots(date).then((slots) => {
      if (date !== state.date) return;
      slots.forEach(({ slot, available, remaining }) => {
        const input = form.querySelector(`input[name="time"][value="${slot}"]`);
        if (input) disable(input, !available, remaining === 0);
      });
    }).catch(() => {});
  }

  // ---- Récap vivant : barre de l'étape 1, panier latéral, repères d'étapes, bouton final ----
  function refreshSummary() {
    const n = cartCount();
    const total = `${cartTotal()}€`;
    const time = pickedTime();
    const pickup = time ? `${longDate.format(fromISO(state.date))} à ${time.value}` : '';

    $('order-bar-count').textContent = n ? articles(n) : 'Votre panier est vide';
    $('order-bar-amount').textContent = total;
    form.querySelector('.order-bar').classList.toggle('is-filled', n > 0);

    const list = $('order-recap-list');
    list.replaceChildren(...[...state.cart].map(([name, q]) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="order-recap-qty"></span><span class="order-recap-name"></span><span class="order-recap-price"></span>';
      li.children[0].textContent = `${q}×`;
      li.children[1].textContent = name;
      li.children[2].textContent = `${q * priceOf(name)}€`;
      return li;
    }));
    $('order-recap-empty').hidden = n > 0;
    $('order-recap-total').textContent = total;
    const recapPickup = $('order-recap-pickup');
    recapPickup.hidden = !time;
    recapPickup.textContent = time ? `Retrait ${pickup}` : '';

    form.querySelector('[data-meta="1"]').textContent = n ? `${articles(n)} · ${total}` : '';
    form.querySelector('[data-meta="2"]').textContent = time ? `${shortDate.format(fromISO(state.date))} · ${time.value}` : '';

    if (!n) { summary.textContent = 'Votre panier est vide'; return; }
    summary.textContent = time ? `${articles(n)} · ${total} · retrait ${pickup}` : `${articles(n)} · ${total} · choisissez l'heure de retrait`;
  }
  form.addEventListener('change', (e) => {
    if (e.target.name === 'time') {
      timeError.hidden = true;
      refreshSummary();
    }
  });

  // ---- Étapes ----
  // Chaque étape se valide avant de laisser passer à la suivante.
  const validators = {
    1: () => {
      const ok = cartCount() > 0;
      itemsError.hidden = ok;
      return ok ? null : form.querySelector('.order-qty-btn[data-step="1"]');
    },
    2: () => {
      const ok = !!pickedTime();
      timeError.hidden = ok;
      return ok ? null : form.querySelector('input[name="time"]:not(:disabled)') || dateInput;
    },
    3: () => {
      const fields = [...form.querySelectorAll('.resa-field input[required]')];
      fields.forEach((f) => f.classList.toggle('is-invalid', !f.checkValidity()));
      return fields.find((f) => !f.checkValidity()) || null;
    },
  };

  const scrollToForm = () => {
    const top = form.getBoundingClientRect().top;
    const navH = document.querySelector('.site-nav')?.offsetHeight || 0;
    if (top < navH || top > window.innerHeight * 0.4) {
      window.scrollTo({ top: window.scrollY + top - navH - 16, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
  };

  function showStep(n, { focus = true } = {}) {
    const from = state.step;
    state.step = n;
    panels.forEach((p) => {
      const on = Number(p.dataset.step) === n;
      p.hidden = !on;
      p.classList.remove('is-entering-fwd', 'is-entering-back');
      if (on && from !== n && !reduceMotion.matches) {
        void p.offsetWidth; // relance l'animation
        p.classList.add(n > from ? 'is-entering-fwd' : 'is-entering-back');
      }
    });
    stepItems.forEach((li, i) => {
      const s = i + 1;
      li.dataset.state = s < n ? 'done' : s === n ? 'current' : 'todo';
      const btn = li.querySelector('.order-steps-btn');
      if (s === n) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
    });
    form.style.setProperty('--order-progress', (n - 1) / (panels.length - 1));
    if (from !== n) scrollToForm();
    if (focus && from !== n) $(`order-step-${n}`).focus({ preventScroll: true });
  }

  // Avancer jusqu'à l'étape n, en s'arrêtant sur la première étape incomplète.
  function goTo(n) {
    for (let s = 1; s < n; s++) {
      const bad = validators[s]();
      if (bad) {
        if (state.step !== s) showStep(s, { focus: false });
        bad.focus({ preventScroll: true });
        bad.closest('.resa-slots, .order-list, .resa-field')?.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
        return false;
      }
    }
    showStep(n);
    return true;
  }

  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) goTo(state.step + 1);
    else if (e.target.closest('[data-back]')) showStep(state.step - 1);
    else {
      const g = e.target.closest('[data-goto]');
      if (g) goTo(Number(g.dataset.goto));
    }
  });

  // ---- Validation + confirmation ----
  form.querySelectorAll('.resa-field input').forEach((input) => {
    input.addEventListener('blur', () => { if (input.value) input.classList.toggle('is-invalid', !input.checkValidity()); });
    input.addEventListener('input', () => { if (input.checkValidity()) input.classList.remove('is-invalid'); });
  });

  const submitBtn = form.querySelector('.resa-cta');
  const submitError = form.querySelector('[data-error-for="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    // Entrée dans un champ avant la dernière étape = « Continuer ».
    if (state.step < panels.length) { goTo(state.step + 1); return; }
    if (!goTo(3)) return;
    const bad = validators[3]();
    if (bad) {
      bad.focus();
      bad.closest('.resa-field').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
      return;
    }

    const time = pickedTime();
    let order;
    submitError.hidden = true;
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    try {
      order = await store.createOrder({
        items: [...state.cart].map(([item, q]) => ({ name: item, quantity: q, unitPriceCents: priceOf(item) * 100 })),
        pickupDate: state.date,
        pickupSlot: time.value,
        customer: { name: form.elements.name.value, email: form.elements.email.value, phone: form.elements.phone.value },
        notes: form.elements.notes.value,
      });
    } catch (err) {
      submitError.textContent = err.message || 'La commande n’a pas pu être enregistrée. Réessayez, ou appelez-nous au 09 87 14 08 50.';
      submitError.hidden = false;
      // Créneau passé ou complet entre-temps : retour au choix de l'heure.
      if (err.code === 'slot_unavailable') { refreshSlots(); showStep(2); timeError.hidden = false; }
      return;
    } finally {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
    }

    const name = order.customer.name.split(' ')[0];
    const d = longDate.format(fromISO(order.pickup.date));
    const lines = order.items.map((i) => `${i.quantity} × ${i.name}`).join(', ');
    $('resa-toast-title').textContent = `À tout à l'heure, ${name} !`;
    $('resa-toast-body').textContent =
      `Commande ${order.ref} : ${lines} — ${euros(order.totalCents)}, à régler au retrait. Rendez-vous ${d} à ${order.pickup.slot}, au 53 bis Bd Arago. Un email de confirmation arrive à ${order.customer.email}.`;
    // L'accusé de réception vient d'être affiché : inutile de le reproposer en notification.
    store.listNotifications()
      .then((ns) => store.markNotificationsRead(ns.filter((n) => n.orderId === order.id && n.kind === 'order_received').map((n) => n.id)))
      .catch(() => {})
      .then(refreshHistory);

    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-open'));
    $('resa-toast-close').focus();
  });

  const closeToast = () => {
    toast.classList.remove('is-open');
    toast.hidden = true;
    form.reset();
    prefillContact();
    state.cart.clear();
    items.forEach(renderItem);
    refreshTabCounts();
    setDate(toISO(today));
    showStep(1, { focus: false });
    $('order-step-1').focus({ preventScroll: true });
  };
  $('resa-toast-close').addEventListener('click', closeToast);
  toast.addEventListener('click', (e) => { if (e.target === toast) closeToast(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !toast.hidden) closeToast(); });

  // ---- Client qui revient : commandes en cours, historique de la semaine, notifications ----
  const history = $('order-history');
  const STATUS_LABELS = {
    pending: 'Reçue', confirmed: 'Confirmée', preparing: 'Au four', ready: 'Prête', collected: 'Retirée', cancelled: 'Annulée',
  };
  const POLL_MS = 45000;
  let pollTimer = null;
  let profile = null;

  function euros(cents) { return `${(cents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}€`; }

  function prefillContact() {
    if (!profile) return;
    ['name', 'email', 'phone'].forEach((k) => { if (profile[k] && !form.elements[k].value) form.elements[k].value = profile[k]; });
  }

  // Remet une ancienne commande dans le panier (seulement les plats toujours à la carte).
  function reorder(order) {
    state.cart.clear();
    order.items.forEach((i) => { if (items.some((li) => li.dataset.name === i.name)) state.cart.set(i.name, i.quantity); });
    items.forEach(renderItem);
    refreshTabCounts();
    refreshSummary();
    itemsError.hidden = true;
    if (state.step === 1) scrollToForm(); else showStep(1);
  }

  function renderOrder(order) {
    const li = document.createElement('li');
    li.className = 'order-history-item';
    li.dataset.status = order.status;
    li.innerHTML = '<div class="order-history-top"><strong class="order-history-ref"></strong><span class="order-history-status"></span></div>'
      + '<p class="order-history-when"></p><p class="order-history-lines"></p>'
      + '<div class="order-history-foot"><span class="order-history-total"></span><span class="order-history-actions"></span></div>';
    li.querySelector('.order-history-ref').textContent = order.ref;
    li.querySelector('.order-history-status').textContent = STATUS_LABELS[order.status] || order.status;
    li.querySelector('.order-history-when').textContent = `${longDate.format(fromISO(order.pickup.date))} · ${order.pickup.slot}`;
    li.querySelector('.order-history-lines').textContent = order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ');
    li.querySelector('.order-history-total').textContent = euros(order.totalCents);
    const actions = li.querySelector('.order-history-actions');
    const action = (label, fn, cls = '') => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `order-history-btn ${cls}`.trim();
      b.textContent = label;
      b.addEventListener('click', fn);
      actions.appendChild(b);
      return b;
    };
    if (order.cancellable) {
      const btn = action('Annuler', async () => {
        if (!window.confirm(`Annuler la commande ${order.ref} ?`)) return;
        btn.disabled = true;
        try { await store.cancelOrder(order.id); } catch (err) { window.alert(err.message); }
        refreshHistory();
      }, 'is-quiet');
    }
    if (!order.active) action('Recommander', () => reorder(order));
    return li;
  }

  async function refreshHistory() {
    if (!store) return;
    let data;
    let notes;
    try {
      [data, notes] = await Promise.all([store.listOrders({ days: 7 }), store.listNotifications()]);
    } catch { return; }
    const { active, past } = data;
    history.hidden = !active.length && !past.length;
    $('order-history-sub').textContent = active.length
      ? `${active.length} en cours${past.length ? ` · ${past.length} ces 7 derniers jours` : ''}`
      : 'Ces 7 derniers jours';
    $('order-active').replaceChildren(...active.map(renderOrder));
    $('order-past').replaceChildren(...past.map(renderOrder));
    $('order-past-wrap').hidden = !past.length;
    $('order-past-wrap').open = !active.length;
    $('order-past-count').textContent = `(${past.length})`;

    // Notifications non lues : changement de statut, confirmation, commande prête…
    const list = $('order-notices');
    list.replaceChildren(...notes.map((n) => {
      const li = document.createElement('li');
      li.className = 'order-history-notice';
      li.dataset.kind = n.kind;
      li.innerHTML = '<p><strong></strong> <span></span></p><button type="button" class="order-history-btn is-quiet">OK</button>';
      li.querySelector('strong').textContent = n.title;
      li.querySelector('p span').textContent = n.body;
      li.querySelector('button').addEventListener('click', async () => {
        await store.markNotificationsRead([n.id]);
        li.remove();
        list.hidden = !list.children.length;
      });
      return li;
    }));
    list.hidden = !notes.length;

    // Suivi en direct (serveur seulement) tant qu'une commande est en cours.
    clearTimeout(pollTimer);
    if (store.mode === 'api' && active.length && !document.hidden) pollTimer = setTimeout(refreshHistory, POLL_MS);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshHistory(); });

  setDate(state.date);
  showStep(1, { focus: false });
  store?.init().then(async () => {
    try { profile = await store.getProfile(); } catch { profile = null; }
    prefillContact();
    refreshSlots();
    refreshHistory();
  });
});
