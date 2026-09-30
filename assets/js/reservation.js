// Otto — réservation : sélecteur de jour, compteur de convives, créneaux,
// validation et confirmation. (La vente à emporter vit sur commander.html.)
// Front-end seul : aucune donnée n'est envoyée tant que le module
// Zenchef (ou équivalent) n'est pas branché (docs/01 §9).

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resa-form');
  if (!form) return;

  const MAX_GUESTS = 6; // au-delà : appel direct (callout groupes)
  const DAYS_SHOWN = 14;
  const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const daysEl = document.getElementById('resa-days');
  const dateInput = document.getElementById('resa-date-input');
  const guestsOut = document.getElementById('resa-guests');
  const guestsHint = document.getElementById('resa-guests-hint');
  const summary = document.getElementById('resa-summary');
  const toast = document.getElementById('resa-toast');

  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateInput.min = toISO(today);

  const state = { date: toISO(today), guests: 2 };

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
    // Date hors bandeau : l'input natif porte la sélection visuellement.
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

  // ---- Créneaux : les heures passées d'aujourd'hui sont grisées ----
  function refreshSlots() {
    const now = new Date();
    const isToday = state.date === toISO(today);
    form.querySelectorAll('input[name="time"]').forEach((input) => {
      const [h, m] = input.value.split(':').map(Number);
      const past = isToday && (h * 60 + m) <= (now.getHours() * 60 + now.getMinutes());
      input.disabled = past;
      if (past && input.checked) input.checked = false;
    });
  }

  // ---- Compteur de convives ----
  const renderGuests = () => {
    guestsOut.innerHTML = `<strong>${state.guests}</strong> ${state.guests > 1 ? 'personnes' : 'personne'}`;
    const [minus, plus] = form.querySelectorAll('.resa-counter-btn');
    minus.disabled = state.guests <= 1;
    plus.disabled = state.guests >= MAX_GUESTS;
    guestsHint.hidden = state.guests < MAX_GUESTS;
    refreshSummary();
  };
  form.querySelectorAll('.resa-counter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.guests = Math.max(1, Math.min(MAX_GUESTS, state.guests + Number(btn.dataset.step)));
      renderGuests();
    });
  });

  // ---- Récap vivant dans le bouton ----
  function refreshSummary() {
    const time = form.querySelector('input[name="time"]:checked');
    const d = longDate.format(fromISO(state.date));
    summary.textContent = time ? `${d} à ${time.value} · ${state.guests} pers.` : 'Choisissez un créneau';
  }
  form.addEventListener('change', (e) => {
    if (e.target.name === 'time') {
      form.querySelector('[data-error-for="time"]').hidden = true;
      refreshSummary();
    }
  });

  // ---- Validation + confirmation ----
  form.querySelectorAll('.resa-field input').forEach((input) => {
    input.addEventListener('blur', () => { if (input.value) input.classList.toggle('is-invalid', !input.checkValidity()); });
    input.addEventListener('input', () => { if (input.checkValidity()) input.classList.remove('is-invalid'); });
  });

  let lastFocus = null;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const time = form.querySelector('input[name="time"]:checked');
    const timeError = form.querySelector('[data-error-for="time"]');
    timeError.hidden = !!time;

    const fields = [...form.querySelectorAll('.resa-field input[required]')];
    fields.forEach((f) => f.classList.toggle('is-invalid', !f.checkValidity()));
    const firstBad = !time ? form.querySelector('input[name="time"]:not(:disabled)') : fields.find((f) => !f.checkValidity());
    if (firstBad) {
      firstBad.focus();
      firstBad.closest('.resa-step').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const name = form.elements.name.value.trim().split(' ')[0];
    const d = longDate.format(fromISO(state.date));
    document.getElementById('resa-toast-title').textContent = `Votre table est réservée, ${name}.`;
    document.getElementById('resa-toast-body').textContent = `${state.guests} ${state.guests > 1 ? 'couverts' : 'couvert'}, ${d} à ${time.value}. Un email de confirmation arrive à ${form.elements.email.value}. Votre table vous attend 15 min.`;

    lastFocus = document.activeElement;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-open'));
    document.getElementById('resa-toast-close').focus();
  });

  const closeToast = () => {
    toast.classList.remove('is-open');
    toast.hidden = true;
    form.reset();
    state.guests = 2;
    renderGuests();
    setDate(toISO(today));
    if (lastFocus) lastFocus.focus();
  };
  document.getElementById('resa-toast-close').addEventListener('click', closeToast);
  toast.addEventListener('click', (e) => { if (e.target === toast) closeToast(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !toast.hidden) closeToast(); });

  renderGuests();
  setDate(state.date);
});
