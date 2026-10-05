// Otto — réservation : sélecteur de jour, compteur de convives, créneaux,
// validation et confirmation. (La vente à emporter vit sur commander.html.)
// Front-end seul : aucune donnée n'est envoyée tant que le module
// Zenchef (ou équivalent) n'est pas branché (docs/01 §9).
// Même script pour reservation.html et chaque <langue>/reservation.html : les textes dépendent de <html lang>.

const RESA_I18N = {
  fr: {
    locale: 'fr-FR',
    dayNames: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    months: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    today: 'Auj.',
    guests: (n) => (n > 1 ? 'personnes' : 'personne'),
    summary: (date, time, n) => `${date} à ${time} · ${n} pers.`,
    noSlot: 'Choisissez un créneau',
    toastTitle: (name) => `Votre table est réservée, ${name}.`,
    toastBody: ({ n, date, time, email }) => `${n} ${n > 1 ? 'couverts' : 'couvert'}, ${date} à ${time}. Un email de confirmation arrive à ${email}. Votre table vous attend 15 min.`,
  },
  en: {
    locale: 'en-GB',
    dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    today: 'Today',
    guests: (n) => (n > 1 ? 'guests' : 'guest'),
    summary: (date, time, n) => `${date} at ${time} · ${n} ${n > 1 ? 'guests' : 'guest'}`,
    noSlot: 'Choose a time slot',
    toastTitle: (name) => `Your table is booked, ${name}.`,
    toastBody: ({ n, date, time, email }) => `Table for ${n}, ${date} at ${time}. A confirmation email is on its way to ${email}. We'll hold your table for 15 minutes.`,
  },
  it: {
    locale: 'it-IT',
    dayNames: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
    months: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
    today: 'Oggi',
    guests: (n) => (n > 1 ? 'persone' : 'persona'),
    summary: (date, time, n) => `${date} alle ${time} · ${n} ${n > 1 ? 'persone' : 'persona'}`,
    noSlot: 'Scegliete un orario',
    toastTitle: (name) => `Il vostro tavolo è prenotato, ${name}.`,
    toastBody: ({ n, date, time, email }) => `Tavolo per ${n}, ${date} alle ${time}. Un’email di conferma è in arrivo a ${email}. Il tavolo vi aspetta per 15 minuti.`,
  },
  es: {
    locale: 'es-ES',
    dayNames: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
    today: 'Hoy',
    guests: (n) => (n > 1 ? 'personas' : 'persona'),
    summary: (date, time, n) => `${date} a las ${time} · ${n} ${n > 1 ? 'personas' : 'persona'}`,
    noSlot: 'Elija una hora',
    toastTitle: (name) => `Su mesa está reservada, ${name}.`,
    toastBody: ({ n, date, time, email }) => `Mesa para ${n}, el ${date} a las ${time}. Le hemos enviado un email de confirmación a ${email}. Le guardamos la mesa 15 minutos.`,
  },
  de: {
    locale: 'de-DE',
    dayNames: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    months: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
    today: 'Heute',
    guests: (n) => (n > 1 ? 'Personen' : 'Person'),
    summary: (date, time, n) => `${date} um ${time} · ${n} Pers.`,
    noSlot: 'Uhrzeit wählen',
    toastTitle: (name) => `Ihr Tisch ist reserviert, ${name}.`,
    toastBody: ({ n, date, time, email }) => `Tisch für ${n}, ${date} um ${time}. Eine Bestätigung ist unterwegs an ${email}. Wir halten Ihren Tisch 15 Minuten frei.`,
  },
  pl: {
    locale: 'pl-PL',
    dayNames: ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'],
    months: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'],
    today: 'Dziś',
    guests: (n) => (n === 1 ? 'osoba' : n <= 4 ? 'osoby' : 'osób'),
    summary: (date, time, n) => `${date}, godz. ${time} · ${n} os.`,
    noSlot: 'Wybierz godzinę',
    toastTitle: (name) => `Stolik zarezerwowany, ${name}.`,
    toastBody: ({ n, date, time, email }) => `Stolik dla ${n} os., ${date}, godz. ${time}. Potwierdzenie wysłaliśmy na ${email}. Stolik czeka na Ciebie 15 minut.`,
  },
  zh: {
    locale: 'zh-CN',
    dayNames: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    today: '今天',
    guests: () => '位',
    summary: (date, time, n) => `${date} ${time} · ${n} 位`,
    noSlot: '请选择时间',
    toastTitle: (name) => `${name}，您的餐位已预订。`,
    toastBody: ({ n, date, time, email }) => `${n} 位，${date} ${time}。确认邮件已发送至 ${email}。餐位为您保留 15 分钟。`,
  },
  ru: {
    locale: 'ru-RU',
    dayNames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    months: ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
    today: 'Сегодня',
    guests: (n) => (n === 1 ? 'гость' : n <= 4 ? 'гостя' : 'гостей'),
    summary: (date, time, n) => `${date} в ${time} · ${n} ${n === 1 ? 'гость' : n <= 4 ? 'гостя' : 'гостей'}`,
    noSlot: 'Выберите время',
    toastTitle: (name) => `Ваш столик забронирован, ${name}.`,
    toastBody: ({ n, date, time, email }) => `Столик на ${n}, ${date} в ${time}. Подтверждение отправлено на ${email}. Мы держим столик 15 минут.`,
  },
  ja: {
    locale: 'ja-JP',
    dayNames: ['日', '月', '火', '水', '木', '金', '土'],
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    today: '今日',
    guests: () => '名',
    summary: (date, time, n) => `${date} ${time} · ${n}名`,
    noSlot: '時間をお選びください',
    toastTitle: (name) => `${name} 様、ご予約を承りました。`,
    toastBody: ({ n, date, time, email }) => `${n}名様、${date} ${time}。確認メールを ${email} にお送りしました。お席は15分間お取り置きします。`,
  },
  el: {
    locale: 'el-GR',
    dayNames: ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'],
    months: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'],
    today: 'Σήμερα',
    guests: (n) => (n > 1 ? 'άτομα' : 'άτομο'),
    summary: (date, time, n) => `${date} στις ${time} · ${n} ${n > 1 ? 'άτομα' : 'άτομο'}`,
    noSlot: 'Επιλέξτε ώρα',
    toastTitle: (name) => `Το τραπέζι σας κρατήθηκε, ${name}.`,
    toastBody: ({ n, date, time, email }) => `Τραπέζι για ${n}, ${date} στις ${time}. Το email επιβεβαίωσης στάλθηκε στο ${email}. Το τραπέζι σας περιμένει 15 λεπτά.`,
  },
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resa-form');
  if (!form) return;

  const T = RESA_I18N[document.documentElement.lang] || RESA_I18N.fr;
  const MAX_GUESTS = 6; // au-delà : appel direct (callout groupes)
  const DAYS_SHOWN = 14;
  const DAY_NAMES = T.dayNames;
  const MONTHS = T.months;
  const longDate = new Intl.DateTimeFormat(T.locale, { weekday: 'long', day: 'numeric', month: 'long' });

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
    guestsOut.innerHTML = `<strong>${state.guests}</strong> ${T.guests(state.guests)}`;
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
    summary.textContent = time ? T.summary(d, time.value, state.guests) : T.noSlot;
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
    document.getElementById('resa-toast-title').textContent = T.toastTitle(name);
    document.getElementById('resa-toast-body').textContent = T.toastBody({ n: state.guests, date: d, time: time.value, email: form.elements.email.value });

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
