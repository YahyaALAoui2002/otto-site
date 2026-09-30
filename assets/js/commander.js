// Otto — commande à emporter, en trois étapes :
// 1. le panier, 2. le retrait (jour + heure), 3. les coordonnées.
// (La réservation de table vit sur reservation.html.)
// La commande est enregistrée via window.OttoStore (order-store.js) :
// SQLite derrière /api quand le site est servi par server/server.js,
// localStorage sinon. Un client qui revient retrouve ses commandes en haut de page.
// Même script pour commander.html et en/commander.html : les textes dépendent de <html lang>.
// Les data-name restent en français (la carte de référence côté serveur) ;
// en anglais, data-label donne le nom affiché.
// Suppléments : data-extras="Parmesan:1|Burrata:3:fromage|…" (nom:prix[:groupe]) ;
// un seul choix par groupe. Le « + » d'un plat qui en a ouvre le panneau de choix.

const ORDER_I18N = {
  fr: {
    locale: 'fr-FR',
    dayNames: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    months: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    today: 'Auj.',
    money: (n) => `${n}€`,
    articles: (n) => `${n} ${n > 1 ? 'articles' : 'article'}`,
    cartEmpty: 'Votre panier est vide',
    at: (date, time) => `${date} à ${time}`,
    recapPickup: (p) => `Retrait ${p}`,
    summaryPickup: (p) => `retrait ${p}`,
    summaryNoTime: 'choisissez l\'heure de retrait',
    submitFailed: 'La commande n’a pas pu être enregistrée. Réessayez, ou appelez-nous au 09 87 14 08 50.',
    errors: null, // messages du serveur / d'order-store.js, déjà en français
    toastTitle: (name) => `À tout à l'heure, ${name} !`,
    toastBody: ({ ref, lines, total, date, slot, email }) =>
      `Commande ${ref} : ${lines} — ${total}, à régler au retrait. Rendez-vous ${date} à ${slot}, au 53 bis Bd Arago. Un email de confirmation arrive à ${email}.`,
    status: { pending: 'Reçue', confirmed: 'Confirmée', preparing: 'Au four', ready: 'Prête', collected: 'Retirée', cancelled: 'Annulée' },
    cancel: 'Annuler',
    confirmCancel: (ref) => `Annuler la commande ${ref} ?`,
    reorder: 'Recommander',
    historyActive: (a, p) => `${a} en cours${p ? ` · ${p} ces 7 derniers jours` : ''}`,
    historyPast: 'Ces 7 derniers jours',
    notice: null, // titre et texte fournis tels quels par le store
    extraLabels: null, // noms des suppléments : ceux de la carte
    extrasPaid: 'Suppléments',
    extrasFree: 'Sur demande',
    extrasTitle: (dish) => `Votre ${dish}, à votre goût`,
    extrasGroups: { fromage: 'Fromage — un seul au choix' },
    extrasAdd: (price) => `Ajouter · ${price}`,
    extrasCancel: 'Annuler',
    plain: 'Sans supplément',
    removeLine: (label) => `Retirer : ${label}`,
  },
  en: {
    locale: 'en-GB',
    dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    today: 'Today',
    money: (n) => `€${n}`,
    articles: (n) => `${n} ${n > 1 ? 'items' : 'item'}`,
    cartEmpty: 'Your cart is empty',
    at: (date, time) => `${date} at ${time}`,
    recapPickup: (p) => `Pickup ${p}`,
    summaryPickup: (p) => `pickup ${p}`,
    summaryNoTime: 'choose a pickup time',
    submitFailed: 'We couldn’t place your order. Please try again, or call us on 09 87 14 08 50.',
    errors: {
      slot_unavailable: 'That pickup time is no longer available — please choose another.',
      invalid_slot: 'That pickup time is no longer available — please choose another.',
      invalid_date: 'Please choose a valid pickup date.',
      invalid_items: 'Your cart is empty.',
      unknown_item: 'One of the dishes in your cart is no longer on the menu.',
      invalid_quantity: 'Please check the quantities in your cart.',
      invalid_name: 'Please enter your name.',
      invalid_email: 'Please enter a valid email address.',
      invalid_phone: 'Please enter a valid phone number.',
      rate_limited: 'Too many orders — please try again in a few minutes.',
      storage_full: 'We couldn’t save your order on this device.',
      not_found: 'Order not found.',
      not_cancellable: 'Too late to cancel online — please call us on 09 87 14 08 50.',
      invalid_extras: 'One of the extras in your cart is no longer available.',
      network: 'The server isn’t responding.',
    },
    toastTitle: (name) => `See you soon, ${name}!`,
    toastBody: ({ ref, lines, total, date, slot, email }) =>
      `Order ${ref}: ${lines} — ${total}, to pay at pickup. See you ${date} at ${slot}, at 53 bis Bd Arago. A confirmation email is on its way to ${email}.`,
    status: { pending: 'Received', confirmed: 'Confirmed', preparing: 'In the oven', ready: 'Ready', collected: 'Collected', cancelled: 'Cancelled' },
    cancel: 'Cancel',
    confirmCancel: (ref) => `Cancel order ${ref}?`,
    reorder: 'Order again',
    historyActive: (a, p) => `${a} in progress${p ? ` · ${p} in the last 7 days` : ''}`,
    historyPast: 'Last 7 days',
    // Les notifications sont rédigées en français par le store : on les réécrit ici.
    notice: {
      order_received: (ref) => ['Order received', `Order ${ref} received — we’ll confirm it as soon as the oven has it in sight.`],
      order_confirmed: (ref) => ['Order confirmed', `Order ${ref} is confirmed — pickup at 53 bis Bd Arago.`],
      order_preparing: (ref) => ['In the oven!', `Your order ${ref} is being prepared.`],
      order_ready: (ref) => ['Ready at the counter', `Your order ${ref} is waiting for you, piping hot, at 53 bis Bd Arago.`],
      order_collected: (ref) => ['Buon appetito!', `Thank you for your order ${ref}. See you soon at Otto.`],
      order_cancelled: (ref) => ['Order cancelled', `Your order ${ref} has been cancelled.`],
      order_reminder: (ref) => ['Reminder: pickup soon', `Your order ${ref} will be ready shortly at 53 bis Bd Arago. Payment on pickup.`],
    },
    extraLabels: {
      'Parmesan': 'Parmesan',
      'Burrata': 'Burrata',
      'Bufala': 'Buffalo mozzarella',
      'Stracciatella': 'Stracciatella',
      'Burratina': 'Burratina',
      'Jambon de Parme': 'Parma ham',
      'Version végétarienne': 'Vegetarian version',
    },
    extrasPaid: 'Extras',
    extrasFree: 'On request',
    extrasTitle: (dish) => `Your ${dish}, your way`,
    extrasGroups: { fromage: 'Cheese — pick one' },
    extrasAdd: (price) => `Add · ${price}`,
    extrasCancel: 'Cancel',
    plain: 'No extras',
    removeLine: (label) => `Remove: ${label}`,
  },
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('order-form');
  if (!form) return;

  const T = ORDER_I18N[document.documentElement.lang === 'en' ? 'en' : 'fr'];
  const MAX_QTY = 9;
  const DAYS_SHOWN = 14;
  const DAY_NAMES = T.dayNames;
  const MONTHS = T.months;
  const longDate = new Intl.DateTimeFormat(T.locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = new Intl.DateTimeFormat(T.locale, { weekday: 'short', day: 'numeric', month: 'short' });
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

  // Panier : une ligne par plat + combinaison de suppléments.
  // clé « Margherita|Parmesan+Burrata » → { name, extras: ['Parmesan', 'Burrata'], qty }
  const state = { date: toISO(today), cart: new Map(), step: 1 };

  // ---- Panier ----
  const items = [...form.querySelectorAll('.order-item')];
  const itemOf = (name) => items.find((li) => li.dataset.name === name);
  const parseExtras = (attr) => (attr ? attr.split('|').map((e) => {
    const [name, price, group] = e.split(':').map((x) => x.trim());
    return { name, price: Number(price), group: group || null };
  }) : []);
  const EXTRAS = new Map(items.map((li) => [li.dataset.name, parseExtras(li.dataset.extras)]));
  const priceOf = (name) => Number(itemOf(name).dataset.price);
  const labelOf = (name) => itemOf(name)?.dataset.label || name;
  const extraLabel = (name) => T.extraLabels?.[name] || name;
  const unitPrice = (line) => priceOf(line.name)
    + line.extras.reduce((t, x) => t + (EXTRAS.get(line.name).find((e) => e.name === x)?.price || 0), 0);
  const lineLabel = (name, extras = []) => [labelOf(name), ...extras.map(extraLabel)].join(' + ');
  const linesOf = (name) => [...state.cart.values()].filter((l) => l.name === name);
  const dishCount = (name) => linesOf(name).reduce((n, l) => n + l.qty, 0);
  const cartCount = () => [...state.cart.values()].reduce((n, l) => n + l.qty, 0);
  const cartTotal = () => [...state.cart.values()].reduce((t, l) => t + l.qty * unitPrice(l), 0);
  const pickedTime = () => form.querySelector('input[name="time"]:checked');
  const articles = T.articles;

  // Ajoute (ou retire, delta < 0) au panier, sans dépasser MAX_QTY par plat ;
  // les suppléments suivent l'ordre de la carte.
  function addLine(name, extras, delta) {
    const sorted = EXTRAS.get(name).filter((e) => extras.includes(e.name)).map((e) => e.name);
    const key = `${name}|${sorted.join('+')}`;
    const line = state.cart.get(key) || { name, extras: sorted, qty: 0 };
    const others = dishCount(name) - (state.cart.has(key) ? line.qty : 0);
    line.qty = Math.max(0, Math.min(line.qty + delta, MAX_QTY - others));
    if (line.qty) state.cart.set(key, line); else state.cart.delete(key);
  }

  function cartChanged() {
    items.forEach(renderItem);
    if (cartCount()) itemsError.hidden = true;
    refreshTabCounts();
    refreshSummary();
  }

  function renderItem(li) {
    const name = li.dataset.name;
    const qty = dishCount(name);
    li.querySelector('.order-qty-val').textContent = qty;
    const [minus, plus] = li.querySelectorAll('.order-qty-btn');
    minus.disabled = qty <= 0;
    plus.disabled = qty >= MAX_QTY;
    li.classList.toggle('is-picked', qty > 0);

    // Détail des lignes sous le plat dès qu'un supplément est choisi :
    // indispensable sur mobile, où le panier latéral est masqué.
    const lines = linesOf(name);
    let list = li.querySelector('.order-item-lines');
    if (!lines.some((l) => l.extras.length)) { list?.remove(); return; }
    if (!list) {
      list = document.createElement('ul');
      list.className = 'order-item-lines';
      const panel = li.querySelector('.order-extras');
      if (panel) panel.before(list); else li.appendChild(list);
    }
    list.replaceChildren(...lines.map((l) => {
      const row = document.createElement('li');
      row.innerHTML = '<span class="order-item-line-qty"></span><span class="order-item-line-name"></span>'
        + '<span class="order-item-line-price"></span><button type="button" class="order-item-line-del">×</button>';
      row.children[0].textContent = `${l.qty}×`;
      row.children[1].textContent = l.extras.length ? `+ ${l.extras.map(extraLabel).join(', ')}` : T.plain;
      row.children[2].textContent = T.money(l.qty * unitPrice(l));
      const del = row.children[3];
      del.setAttribute('aria-label', T.removeLine(lineLabel(name, l.extras)));
      del.addEventListener('click', () => {
        addLine(name, l.extras, -1);
        cartChanged();
        (li.querySelector('.order-item-line-del') || plus).focus();
      });
      return row;
    }));
  }

  // Mention des suppléments sous la description, d'après data-extras.
  items.forEach((li) => {
    const defs = EXTRAS.get(li.dataset.name);
    if (!defs.length) return;
    const hint = document.createElement('span');
    hint.className = 'order-item-extras';
    hint.textContent = `${defs.some((e) => e.price > 0) ? T.extrasPaid : T.extrasFree} · `
      + defs.map((e) => (e.price ? `${extraLabel(e.name)} +${T.money(e.price)}` : extraLabel(e.name))).join(' · ');
    li.querySelector('.order-item-body').appendChild(hint);
  });

  // ---- Panneau de suppléments : s'ouvre sous le plat au clic sur « + » ----
  function closeExtras(li, { focus = false } = {}) {
    const panel = li.querySelector('.order-extras');
    if (!panel) return;
    panel.remove();
    li.classList.remove('is-customizing');
    if (focus) li.querySelector('.order-qty-btn[data-step="1"]').focus();
  }

  function openExtras(li) {
    items.forEach((other) => { if (other !== li) closeExtras(other); });
    const open = li.querySelector('.order-extras');
    if (open) { open.querySelector('.order-extras-add').focus(); return; }
    const name = li.dataset.name;
    const panel = document.createElement('div');
    panel.className = 'order-extras';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', T.extrasTitle(labelOf(name)));
    const title = document.createElement('p');
    title.className = 'order-extras-title';
    title.textContent = T.extrasTitle(labelOf(name));
    panel.appendChild(title);

    // Suppléments libres d'abord, puis un bloc par groupe (un seul choix).
    const blocks = [];
    EXTRAS.get(name).forEach((e) => {
      let block = blocks.find((b) => b.group === e.group);
      if (!block) blocks.push(block = { group: e.group, defs: [] });
      block.defs.push(e);
    });
    blocks.forEach(({ group, defs }) => {
      const wrap = document.createElement('div');
      wrap.className = 'order-extras-opts';
      if (group) {
        const legend = document.createElement('p');
        legend.className = 'order-extras-legend';
        legend.textContent = T.extrasGroups?.[group] || group;
        wrap.appendChild(legend);
      }
      defs.forEach((e) => {
        const label = document.createElement('label');
        label.className = 'order-extra';
        label.innerHTML = '<input type="checkbox"><span class="order-extra-name"></span><span class="order-extra-price"></span>';
        const input = label.querySelector('input');
        input.value = e.name;
        if (group) input.dataset.group = group;
        label.querySelector('.order-extra-name').textContent = extraLabel(e.name);
        label.querySelector('.order-extra-price').textContent = e.price ? `+${T.money(e.price)}` : T.money(0);
        wrap.appendChild(label);
      });
      panel.appendChild(wrap);
    });

    const actions = document.createElement('div');
    actions.className = 'order-extras-actions';
    actions.innerHTML = '<button type="button" class="order-extras-cancel"></button><button type="button" class="order-extras-add"></button>';
    const cancel = actions.querySelector('.order-extras-cancel');
    const add = actions.querySelector('.order-extras-add');
    cancel.textContent = T.extrasCancel;
    panel.appendChild(actions);

    const checked = () => [...panel.querySelectorAll('input:checked')].map((i) => i.value);
    const refreshAdd = () => { add.textContent = T.extrasAdd(T.money(unitPrice({ name, extras: checked() }))); };
    panel.addEventListener('change', (e) => {
      const g = e.target.dataset.group;
      if (g && e.target.checked) {
        panel.querySelectorAll(`input[data-group="${g}"]`).forEach((i) => { if (i !== e.target) i.checked = false; });
      }
      refreshAdd();
    });
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeExtras(li, { focus: true }); }
      // Entrée sur une case = ajouter, et non passer à l'étape suivante.
      if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); add.click(); }
    });
    cancel.addEventListener('click', () => closeExtras(li, { focus: true }));
    add.addEventListener('click', () => {
      addLine(name, checked(), 1);
      closeExtras(li, { focus: true });
      cartChanged();
    });
    refreshAdd();

    li.appendChild(panel);
    li.classList.add('is-customizing');
    panel.querySelector('input').focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }

  items.forEach((li) => {
    li.querySelectorAll('.order-qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = li.dataset.name;
        if (Number(btn.dataset.step) > 0) {
          if (EXTRAS.get(name).length) { openExtras(li); return; }
          addLine(name, [], 1);
        } else {
          // « − » retire la dernière variante ajoutée de ce plat.
          const last = linesOf(name).pop();
          if (last) addLine(name, last.extras, -1);
          closeExtras(li);
        }
        cartChanged();
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
      const n = [...cat.querySelectorAll('.order-item')].reduce((s, li) => s + dishCount(li.dataset.name), 0);
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
    btn.innerHTML = `<span class="resa-day-name">${i === 0 ? T.today : DAY_NAMES[d.getDay()]}</span>`
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
    const total = T.money(cartTotal());
    const time = pickedTime();
    const pickup = time ? T.at(longDate.format(fromISO(state.date)), time.value) : '';

    $('order-bar-count').textContent = n ? articles(n) : T.cartEmpty;
    $('order-bar-amount').textContent = total;
    form.querySelector('.order-bar').classList.toggle('is-filled', n > 0);

    const list = $('order-recap-list');
    list.replaceChildren(...[...state.cart.values()].map((l) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="order-recap-qty"></span><span class="order-recap-name"></span><span class="order-recap-price"></span>';
      li.children[0].textContent = `${l.qty}×`;
      li.children[1].textContent = labelOf(l.name);
      if (l.extras.length) {
        const sub = document.createElement('span');
        sub.className = 'order-recap-extras';
        sub.textContent = `+ ${l.extras.map(extraLabel).join(', ')}`;
        li.children[1].appendChild(sub);
      }
      li.children[2].textContent = T.money(l.qty * unitPrice(l));
      return li;
    }));
    $('order-recap-empty').hidden = n > 0;
    $('order-recap-total').textContent = total;
    const recapPickup = $('order-recap-pickup');
    recapPickup.hidden = !time;
    recapPickup.textContent = time ? T.recapPickup(pickup) : '';

    form.querySelector('[data-meta="1"]').textContent = n ? `${articles(n)} · ${total}` : '';
    form.querySelector('[data-meta="2"]').textContent = time ? `${shortDate.format(fromISO(state.date))} · ${time.value}` : '';

    if (!n) { summary.textContent = T.cartEmpty; return; }
    summary.textContent = `${articles(n)} · ${total} · ${time ? T.summaryPickup(pickup) : T.summaryNoTime}`;
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
        items: [...state.cart.values()].map((l) => ({ name: l.name, extras: l.extras, quantity: l.qty, unitPriceCents: unitPrice(l) * 100 })),
        pickupDate: state.date,
        pickupSlot: time.value,
        customer: { name: form.elements.name.value, email: form.elements.email.value, phone: form.elements.phone.value },
        notes: form.elements.notes.value,
      });
    } catch (err) {
      submitError.textContent = errorText(err);
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
    const lines = order.items.map((i) => `${i.quantity} × ${lineLabel(i.name, i.extras)}`).join(', ');
    $('resa-toast-title').textContent = T.toastTitle(name);
    $('resa-toast-body').textContent = T.toastBody({
      ref: order.ref, lines, total: euros(order.totalCents), date: d, slot: order.pickup.slot, email: order.customer.email,
    });
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
    items.forEach((li) => closeExtras(li));
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
  const STATUS_LABELS = T.status;
  const POLL_MS = 45000;
  let pollTimer = null;
  let profile = null;

  function euros(cents) { return T.money((cents / 100).toLocaleString(T.locale, { maximumFractionDigits: 2 })); }

  // En français, le message du store s'affiche tel quel ; sinon on le traduit d'après son code.
  function errorText(err) {
    if (!T.errors) return err.message || T.submitFailed;
    return T.errors[err.code] || T.submitFailed;
  }

  function prefillContact() {
    if (!profile) return;
    ['name', 'email', 'phone'].forEach((k) => { if (profile[k] && !form.elements[k].value) form.elements[k].value = profile[k]; });
  }

  // Remet une ancienne commande dans le panier (seulement les plats et suppléments toujours à la carte).
  function reorder(order) {
    state.cart.clear();
    order.items.forEach((i) => { if (itemOf(i.name)) addLine(i.name, i.extras || [], i.quantity); });
    items.forEach((li) => closeExtras(li));
    cartChanged();
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
    li.querySelector('.order-history-lines').textContent = order.items.map((i) => `${i.quantity}× ${lineLabel(i.name, i.extras)}`).join(', ');
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
      const btn = action(T.cancel, async () => {
        if (!window.confirm(T.confirmCancel(order.ref))) return;
        btn.disabled = true;
        try { await store.cancelOrder(order.id); } catch (err) { window.alert(errorText(err)); }
        refreshHistory();
      }, 'is-quiet');
    }
    if (!order.active) action(T.reorder, () => reorder(order));
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
      ? T.historyActive(active.length, past.length)
      : T.historyPast;
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
      const [title, body] = T.notice?.[n.kind]?.(n.orderRef) || [n.title, n.body];
      li.querySelector('strong').textContent = title;
      li.querySelector('p span').textContent = body;
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
