// Otto — commande à emporter, en trois étapes :
// 1. le panier, 2. le retrait (jour + heure), 3. les coordonnées.
// (La réservation de table vit sur reservation.html.)
// La commande est enregistrée via window.OttoStore (order-store.js) :
// SQLite derrière /api quand le site est servi par server/server.js,
// localStorage sinon. Un client qui revient retrouve ses commandes en haut de page.
// Même script pour commander.html et chaque <langue>/commander.html : les textes dépendent de <html lang>.
// Les data-name restent en français (la carte de référence côté serveur) ;
// dans les autres langues, data-label donne le nom affiché.
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
  it: {
    locale: 'it-IT',
    dayNames: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
    months: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
    today: 'Oggi',
    money: (n) => `${n} €`,
    articles: (n) => `${n} ${n > 1 ? 'articoli' : 'articolo'}`,
    cartEmpty: 'Il carrello è vuoto',
    at: (date, time) => `${date} alle ${time}`,
    recapPickup: (p) => `Ritiro ${p}`,
    summaryPickup: (p) => `ritiro ${p}`,
    summaryNoTime: 'scegliete l’orario di ritiro',
    submitFailed: 'Non siamo riusciti a registrare l’ordine. Riprovate o chiamateci allo 09 87 14 08 50.',
    errors: {
      slot_unavailable: 'Questo orario di ritiro non è più disponibile — sceglietene un altro.',
      invalid_slot: 'Questo orario di ritiro non è più disponibile — sceglietene un altro.',
      invalid_date: 'Scegliete una data di ritiro valida.',
      invalid_items: 'Il carrello è vuoto.',
      unknown_item: 'Uno dei piatti nel carrello non è più nel menù.',
      invalid_quantity: 'Controllate le quantità nel carrello.',
      invalid_name: 'Inserite il vostro nome.',
      invalid_email: 'Inserite un indirizzo email valido.',
      invalid_phone: 'Inserite un numero di telefono valido.',
      rate_limited: 'Troppi ordini — riprovate tra qualche minuto.',
      storage_full: 'Non siamo riusciti a salvare l’ordine su questo dispositivo.',
      not_found: 'Ordine non trovato.',
      not_cancellable: 'Troppo tardi per annullare online — chiamateci allo 09 87 14 08 50.',
      invalid_extras: 'Uno dei supplementi nel carrello non è più disponibile.',
      network: 'Il server non risponde.',
    },
    toastTitle: (name) => `A più tardi, ${name}!`,
    toastBody: ({ ref, lines, total, date, slot, email }) =>
      `Ordine ${ref}: ${lines} — ${total}, da pagare al ritiro. Vi aspettiamo ${date} alle ${slot}, al 53 bis Bd Arago. Un’email di conferma è in arrivo a ${email}.`,
    status: { pending: 'Ricevuto', confirmed: 'Confermato', preparing: 'In forno', ready: 'Pronto', collected: 'Ritirato', cancelled: 'Annullato' },
    cancel: 'Annulla',
    confirmCancel: (ref) => `Annullare l’ordine ${ref}?`,
    reorder: 'Ordina di nuovo',
    historyActive: (a, p) => `${a} in corso${p ? ` · ${p} negli ultimi 7 giorni` : ''}`,
    historyPast: 'Ultimi 7 giorni',
    notice: {
      order_received: (ref) => ['Ordine ricevuto', `Ordine ${ref} ricevuto — lo confermiamo appena il forno è pronto.`],
      order_confirmed: (ref) => ['Ordine confermato', `L’ordine ${ref} è confermato — ritiro al 53 bis Bd Arago.`],
      order_preparing: (ref) => ['In forno!', `Il vostro ordine ${ref} è in preparazione.`],
      order_ready: (ref) => ['Pronto al banco', `Il vostro ordine ${ref} vi aspetta, bello caldo, al 53 bis Bd Arago.`],
      order_collected: (ref) => ['Buon appetito!', `Grazie per l’ordine ${ref}. A presto da Otto.`],
      order_cancelled: (ref) => ['Ordine annullato', `Il vostro ordine ${ref} è stato annullato.`],
      order_reminder: (ref) => ['Promemoria: ritiro a breve', `Il vostro ordine ${ref} sarà pronto a breve al 53 bis Bd Arago. Pagamento al ritiro.`],
    },
    extraLabels: { 'Parmesan': 'Parmigiano', 'Bufala': 'Mozzarella di bufala', 'Jambon de Parme': 'Prosciutto di Parma', 'Version végétarienne': 'Versione vegetariana' },
    extrasPaid: 'Supplementi',
    extrasFree: 'Su richiesta',
    extrasTitle: (dish) => `${dish}, come piace a voi`,
    extrasGroups: { fromage: 'Formaggio — uno a scelta' },
    extrasAdd: (price) => `Aggiungi · ${price}`,
    extrasCancel: 'Annulla',
    plain: 'Senza supplementi',
    removeLine: (label) => `Togli: ${label}`,
  },
  es: {
    locale: 'es-ES',
    dayNames: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
    today: 'Hoy',
    money: (n) => `${n} €`,
    articles: (n) => `${n} ${n > 1 ? 'artículos' : 'artículo'}`,
    cartEmpty: 'Su cesta está vacía',
    at: (date, time) => `${date} a las ${time}`,
    recapPickup: (p) => `Recogida ${p}`,
    summaryPickup: (p) => `recogida ${p}`,
    summaryNoTime: 'elija la hora de recogida',
    submitFailed: 'No hemos podido registrar su pedido. Inténtelo de nuevo o llámenos al 09 87 14 08 50.',
    errors: {
      slot_unavailable: 'Esa hora de recogida ya no está disponible: elija otra.',
      invalid_slot: 'Esa hora de recogida ya no está disponible: elija otra.',
      invalid_date: 'Elija una fecha de recogida válida.',
      invalid_items: 'Su cesta está vacía.',
      unknown_item: 'Uno de los platos de su cesta ya no está en la carta.',
      invalid_quantity: 'Revise las cantidades de su cesta.',
      invalid_name: 'Indique su nombre.',
      invalid_email: 'Indique una dirección de email válida.',
      invalid_phone: 'Indique un número de teléfono válido.',
      rate_limited: 'Demasiados pedidos: inténtelo de nuevo en unos minutos.',
      storage_full: 'No hemos podido guardar su pedido en este dispositivo.',
      not_found: 'Pedido no encontrado.',
      not_cancellable: 'Ya es tarde para cancelar en línea: llámenos al 09 87 14 08 50.',
      invalid_extras: 'Uno de los suplementos de su cesta ya no está disponible.',
      network: 'El servidor no responde.',
    },
    toastTitle: (name) => `¡Hasta luego, ${name}!`,
    toastBody: ({ ref, lines, total, date, slot, email }) =>
      `Pedido ${ref}: ${lines} — ${total}, a pagar al recoger. Le esperamos el ${date} a las ${slot}, en el 53 bis Bd Arago. Le hemos enviado un email de confirmación a ${email}.`,
    status: { pending: 'Recibido', confirmed: 'Confirmado', preparing: 'En el horno', ready: 'Listo', collected: 'Recogido', cancelled: 'Cancelado' },
    cancel: 'Cancelar',
    confirmCancel: (ref) => `¿Cancelar el pedido ${ref}?`,
    reorder: 'Volver a pedir',
    historyActive: (a, p) => `${a} en curso${p ? ` · ${p} en los últimos 7 días` : ''}`,
    historyPast: 'Últimos 7 días',
    notice: {
      order_received: (ref) => ['Pedido recibido', `Pedido ${ref} recibido: lo confirmamos en cuanto el horno lo tenga a la vista.`],
      order_confirmed: (ref) => ['Pedido confirmado', `El pedido ${ref} está confirmado: recogida en el 53 bis Bd Arago.`],
      order_preparing: (ref) => ['¡Al horno!', `Estamos preparando su pedido ${ref}.`],
      order_ready: (ref) => ['Listo en el mostrador', `Su pedido ${ref} le espera, bien caliente, en el 53 bis Bd Arago.`],
      order_collected: (ref) => ['¡Buon appetito!', `Gracias por su pedido ${ref}. Hasta pronto en Otto.`],
      order_cancelled: (ref) => ['Pedido cancelado', `Su pedido ${ref} ha sido cancelado.`],
      order_reminder: (ref) => ['Recordatorio: recogida en breve', `Su pedido ${ref} estará listo en breve en el 53 bis Bd Arago. Pago al recoger.`],
    },
    extraLabels: { 'Parmesan': 'Parmesano', 'Bufala': 'Mozzarella de búfala', 'Jambon de Parme': 'Jamón de Parma', 'Version végétarienne': 'Versión vegetariana' },
    extrasPaid: 'Suplementos',
    extrasFree: 'Bajo petición',
    extrasTitle: (dish) => `${dish}, a su gusto`,
    extrasGroups: { fromage: 'Queso: elija uno' },
    extrasAdd: (price) => `Añadir · ${price}`,
    extrasCancel: 'Cancelar',
    plain: 'Sin suplementos',
    removeLine: (label) => `Quitar: ${label}`,
  },
  de: {
    locale: 'de-DE',
    dayNames: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    months: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
    today: 'Heute',
    money: (n) => `${n} €`,
    articles: (n) => `${n} ${n > 1 ? 'Artikel' : 'Artikel'}`,
    cartEmpty: 'Ihr Warenkorb ist leer',
    at: (date, time) => `${date} um ${time}`,
    recapPickup: (p) => `Abholung ${p}`,
    summaryPickup: (p) => `Abholung ${p}`,
    summaryNoTime: 'Abholzeit wählen',
    submitFailed: 'Ihre Bestellung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut oder rufen Sie uns an: 09 87 14 08 50.',
    errors: {
      slot_unavailable: 'Diese Abholzeit ist nicht mehr verfügbar – bitte wählen Sie eine andere.',
      invalid_slot: 'Diese Abholzeit ist nicht mehr verfügbar – bitte wählen Sie eine andere.',
      invalid_date: 'Bitte wählen Sie ein gültiges Abholdatum.',
      invalid_items: 'Ihr Warenkorb ist leer.',
      unknown_item: 'Eines der Gerichte in Ihrem Warenkorb ist nicht mehr auf der Karte.',
      invalid_quantity: 'Bitte prüfen Sie die Mengen in Ihrem Warenkorb.',
      invalid_name: 'Bitte geben Sie Ihren Namen ein.',
      invalid_email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      invalid_phone: 'Bitte geben Sie eine gültige Telefonnummer ein.',
      rate_limited: 'Zu viele Bestellungen – bitte versuchen Sie es in ein paar Minuten erneut.',
      storage_full: 'Ihre Bestellung konnte auf diesem Gerät nicht gespeichert werden.',
      not_found: 'Bestellung nicht gefunden.',
      not_cancellable: 'Für eine Online-Stornierung ist es zu spät – bitte rufen Sie uns an: 09 87 14 08 50.',
      invalid_extras: 'Eine der Extras in Ihrem Warenkorb ist nicht mehr verfügbar.',
      network: 'Der Server antwortet nicht.',
    },
    toastTitle: (name) => `Bis gleich, ${name}!`,
    toastBody: ({ ref, lines, total, date, slot, email }) =>
      `Bestellung ${ref}: ${lines} — ${total}, zahlbar bei Abholung. Wir sehen uns ${date} um ${slot}, 53 bis Bd Arago. Eine Bestätigung ist unterwegs an ${email}.`,
    status: { pending: 'Eingegangen', confirmed: 'Bestätigt', preparing: 'Im Ofen', ready: 'Fertig', collected: 'Abgeholt', cancelled: 'Storniert' },
    cancel: 'Stornieren',
    confirmCancel: (ref) => `Bestellung ${ref} stornieren?`,
    reorder: 'Erneut bestellen',
    historyActive: (a, p) => `${a} in Bearbeitung${p ? ` · ${p} in den letzten 7 Tagen` : ''}`,
    historyPast: 'Letzte 7 Tage',
    notice: {
      order_received: (ref) => ['Bestellung eingegangen', `Bestellung ${ref} ist eingegangen – wir bestätigen sie, sobald der Ofen bereit ist.`],
      order_confirmed: (ref) => ['Bestellung bestätigt', `Bestellung ${ref} ist bestätigt – Abholung 53 bis Bd Arago.`],
      order_preparing: (ref) => ['Ab in den Ofen!', `Ihre Bestellung ${ref} wird zubereitet.`],
      order_ready: (ref) => ['Abholbereit an der Theke', `Ihre Bestellung ${ref} wartet ofenheiß auf Sie, 53 bis Bd Arago.`],
      order_collected: (ref) => ['Buon appetito!', `Danke für Ihre Bestellung ${ref}. Bis bald bei Otto.`],
      order_cancelled: (ref) => ['Bestellung storniert', `Ihre Bestellung ${ref} wurde storniert.`],
      order_reminder: (ref) => ['Erinnerung: Abholung in Kürze', `Ihre Bestellung ${ref} ist gleich fertig, 53 bis Bd Arago. Bezahlung bei Abholung.`],
    },
    extraLabels: { 'Bufala': 'Büffelmozzarella', 'Jambon de Parme': 'Parmaschinken', 'Version végétarienne': 'Vegetarische Variante' },
    extrasPaid: 'Extras',
    extrasFree: 'Auf Wunsch',
    extrasTitle: (dish) => `${dish} – ganz nach Ihrem Geschmack`,
    extrasGroups: { fromage: 'Käse – eine Sorte wählen' },
    extrasAdd: (price) => `Hinzufügen · ${price}`,
    extrasCancel: 'Abbrechen',
    plain: 'Ohne Extras',
    removeLine: (label) => `Entfernen: ${label}`,
  },
  pl: {
    locale: 'pl-PL',
    dayNames: ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'],
    months: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'],
    today: 'Dziś',
    money: (n) => `${n} €`,
    articles: (n) => `${n} ${n === 1 ? 'pozycja' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 'pozycje' : 'pozycji'}`,
    cartEmpty: 'Koszyk jest pusty',
    at: (date, time) => `${date}, godz. ${time}`,
    recapPickup: (p) => `Odbiór ${p}`,
    summaryPickup: (p) => `odbiór ${p}`,
    summaryNoTime: 'wybierz godzinę odbioru',
    submitFailed: 'Nie udało się złożyć zamówienia. Spróbuj ponownie lub zadzwoń: 09 87 14 08 50.',
    errors: {
      slot_unavailable: 'Ta godzina odbioru jest już niedostępna — wybierz inną.',
      invalid_slot: 'Ta godzina odbioru jest już niedostępna — wybierz inną.',
      invalid_date: 'Wybierz prawidłową datę odbioru.',
      invalid_items: 'Koszyk jest pusty.',
      unknown_item: 'Jednego z dań w koszyku nie ma już w menu.',
      invalid_quantity: 'Sprawdź ilości w koszyku.',
      invalid_name: 'Podaj swoje imię.',
      invalid_email: 'Podaj prawidłowy adres e-mail.',
      invalid_phone: 'Podaj prawidłowy numer telefonu.',
      rate_limited: 'Zbyt wiele zamówień — spróbuj ponownie za kilka minut.',
      storage_full: 'Nie udało się zapisać zamówienia na tym urządzeniu.',
      not_found: 'Nie znaleziono zamówienia.',
      not_cancellable: 'Za późno na anulowanie online — zadzwoń: 09 87 14 08 50.',
      invalid_extras: 'Jeden z dodatków w koszyku jest już niedostępny.',
      network: 'Serwer nie odpowiada.',
    },
    toastTitle: (name) => `Do zobaczenia, ${name}!`,
    toastBody: ({ ref, lines, total, date, slot, email }) =>
      `Zamówienie ${ref}: ${lines} — ${total}, płatne przy odbiorze. Czekamy ${date} o ${slot}, 53 bis Bd Arago. Potwierdzenie wysłaliśmy na ${email}.`,
    status: { pending: 'Przyjęte', confirmed: 'Potwierdzone', preparing: 'W piecu', ready: 'Gotowe', collected: 'Odebrane', cancelled: 'Anulowane' },
    cancel: 'Anuluj',
    confirmCancel: (ref) => `Anulować zamówienie ${ref}?`,
    reorder: 'Zamów ponownie',
    historyActive: (a, p) => `W realizacji: ${a}${p ? ` · ostatnie 7 dni: ${p}` : ''}`,
    historyPast: 'Ostatnie 7 dni',
    notice: {
      order_received: (ref) => ['Zamówienie przyjęte', `Zamówienie ${ref} przyjęte — potwierdzimy je, gdy tylko piec będzie gotowy.`],
      order_confirmed: (ref) => ['Zamówienie potwierdzone', `Zamówienie ${ref} potwierdzone — odbiór: 53 bis Bd Arago.`],
      order_preparing: (ref) => ['W piecu!', `Przygotowujemy Twoje zamówienie ${ref}.`],
      order_ready: (ref) => ['Gotowe do odbioru', `Twoje zamówienie ${ref} czeka gorące przy 53 bis Bd Arago.`],
      order_collected: (ref) => ['Buon appetito!', `Dziękujemy za zamówienie ${ref}. Do zobaczenia w Otto.`],
      order_cancelled: (ref) => ['Zamówienie anulowane', `Twoje zamówienie ${ref} zostało anulowane.`],
      order_reminder: (ref) => ['Przypomnienie: odbiór wkrótce', `Twoje zamówienie ${ref} będzie zaraz gotowe przy 53 bis Bd Arago. Płatność przy odbiorze.`],
    },
    extraLabels: { 'Parmesan': 'Parmezan', 'Bufala': 'Mozzarella bawola', 'Jambon de Parme': 'Szynka parmeńska', 'Version végétarienne': 'Wersja wegetariańska' },
    extrasPaid: 'Dodatki',
    extrasFree: 'Na życzenie',
    extrasTitle: (dish) => `${dish} — po Twojemu`,
    extrasGroups: { fromage: 'Ser — wybierz jeden' },
    extrasAdd: (price) => `Dodaj · ${price}`,
    extrasCancel: 'Anuluj',
    plain: 'Bez dodatków',
    removeLine: (label) => `Usuń: ${label}`,
  },
  zh: {
    locale: 'zh-CN',
    dayNames: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    today: '今天',
    money: (n) => `€${n}`,
    articles: (n) => `${n} 件`,
    cartEmpty: '购物车是空的',
    at: (date, time) => `${date} ${time}`,
    recapPickup: (p) => `取餐：${p}`,
    summaryPickup: (p) => `取餐 ${p}`,
    summaryNoTime: '请选择取餐时间',
    submitFailed: '订单未能提交。请重试，或致电 09 87 14 08 50。',
    errors: {
      slot_unavailable: '该取餐时间已不可选，请另选时间。',
      invalid_slot: '该取餐时间已不可选，请另选时间。',
      invalid_date: '请选择有效的取餐日期。',
      invalid_items: '购物车是空的。',
      unknown_item: '购物车中的某道菜已下架。',
      invalid_quantity: '请检查购物车中的数量。',
      invalid_name: '请填写您的姓名。',
      invalid_email: '请填写有效的电子邮箱。',
      invalid_phone: '请填写有效的电话号码。',
      rate_limited: '订单过多，请几分钟后再试。',
      storage_full: '无法在此设备上保存您的订单。',
      not_found: '未找到该订单。',
      not_cancellable: '已无法在线取消，请致电 09 87 14 08 50。',
      invalid_extras: '购物车中的某项加料已不可选。',
      network: '服务器无响应。',
    },
    toastTitle: (name) => `${name}，待会儿见！`,
    toastBody: ({ ref, lines, total, date, slot, email }) =>
      `订单 ${ref}：${lines} — ${total}，取餐时付款。请于 ${date} ${slot} 到 53 bis Bd Arago 取餐。确认邮件已发送至 ${email}。`,
    status: { pending: '已接收', confirmed: '已确认', preparing: '烤制中', ready: '可取餐', collected: '已取餐', cancelled: '已取消' },
    cancel: '取消',
    confirmCancel: (ref) => `确定取消订单 ${ref}？`,
    reorder: '再来一单',
    historyActive: (a, p) => `进行中 ${a} 单${p ? ` · 最近 7 天 ${p} 单` : ''}`,
    historyPast: '最近 7 天',
    notice: {
      order_received: (ref) => ['订单已接收', `订单 ${ref} 已接收 —— 窑炉一就绪我们就会确认。`],
      order_confirmed: (ref) => ['订单已确认', `订单 ${ref} 已确认 —— 取餐地址：53 bis Bd Arago。`],
      order_preparing: (ref) => ['正在烤制！', `您的订单 ${ref} 正在制作中。`],
      order_ready: (ref) => ['柜台可取餐', `您的订单 ${ref} 已热腾腾地在 53 bis Bd Arago 等您。`],
      order_collected: (ref) => ['Buon appetito!', `感谢您的订单 ${ref}。期待在 Otto 再见。`],
      order_cancelled: (ref) => ['订单已取消', `您的订单 ${ref} 已取消。`],
      order_reminder: (ref) => ['提醒：即将取餐', `您的订单 ${ref} 即将在 53 bis Bd Arago 备好。取餐时付款。`],
    },
    extraLabels: { 'Parmesan': '帕玛森奶酪', 'Burrata': '布拉塔奶酪', 'Bufala': '水牛马苏里拉', 'Stracciatella': '斯特拉恰泰拉奶酪', 'Burratina': '小布拉塔', 'Jambon de Parme': '帕尔马火腿', 'Version végétarienne': '素食版本' },
    extrasPaid: '加料',
    extrasFree: '可按需',
    extrasTitle: (dish) => `${dish}，按您的口味`,
    extrasGroups: { fromage: '奶酪（任选一种）' },
    extrasAdd: (price) => `添加 · ${price}`,
    extrasCancel: '取消',
    plain: '不加料',
    removeLine: (label) => `移除：${label}`,
  },
  ru: {
    locale: 'ru-RU',
    dayNames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    months: ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
    today: 'Сегодня',
    money: (n) => `${n} €`,
    articles: (n) => {
      const m10 = n % 10, m100 = n % 100;
      const w = m10 === 1 && m100 !== 11 ? 'позиция' : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? 'позиции' : 'позиций';
      return `${n} ${w}`;
    },
    cartEmpty: 'Корзина пуста',
    at: (date, time) => `${date} в ${time}`,
    recapPickup: (p) => `Самовывоз: ${p}`,
    summaryPickup: (p) => `самовывоз ${p}`,
    summaryNoTime: 'выберите время самовывоза',
    submitFailed: 'Не удалось оформить заказ. Попробуйте ещё раз или позвоните нам: 09 87 14 08 50.',
    errors: {
      slot_unavailable: 'Это время самовывоза уже недоступно — выберите другое.',
      invalid_slot: 'Это время самовывоза уже недоступно — выберите другое.',
      invalid_date: 'Выберите корректную дату самовывоза.',
      invalid_items: 'Корзина пуста.',
      unknown_item: 'Одного из блюд в корзине больше нет в меню.',
      invalid_quantity: 'Проверьте количество в корзине.',
      invalid_name: 'Укажите ваше имя.',
      invalid_email: 'Укажите корректный e-mail.',
      invalid_phone: 'Укажите корректный номер телефона.',
      rate_limited: 'Слишком много заказов — попробуйте через несколько минут.',
      storage_full: 'Не удалось сохранить заказ на этом устройстве.',
      not_found: 'Заказ не найден.',
      not_cancellable: 'Отменить онлайн уже поздно — позвоните нам: 09 87 14 08 50.',
      invalid_extras: 'Одна из добавок в корзине больше недоступна.',
      network: 'Сервер не отвечает.',
    },
    toastTitle: (name) => `До встречи, ${name}!`,
    toastBody: ({ ref, lines, total, date, slot, email }) =>
      `Заказ ${ref}: ${lines} — ${total}, оплата при получении. Ждём вас ${date} в ${slot} по адресу 53 bis Bd Arago. Подтверждение отправлено на ${email}.`,
    status: { pending: 'Получен', confirmed: 'Подтверждён', preparing: 'В печи', ready: 'Готов', collected: 'Выдан', cancelled: 'Отменён' },
    cancel: 'Отменить',
    confirmCancel: (ref) => `Отменить заказ ${ref}?`,
    reorder: 'Повторить заказ',
    historyActive: (a, p) => `В работе: ${a}${p ? ` · за 7 дней: ${p}` : ''}`,
    historyPast: 'За последние 7 дней',
    notice: {
      order_received: (ref) => ['Заказ получен', `Заказ ${ref} получен — подтвердим, как только печь будет готова.`],
      order_confirmed: (ref) => ['Заказ подтверждён', `Заказ ${ref} подтверждён — самовывоз: 53 bis Bd Arago.`],
      order_preparing: (ref) => ['В печи!', `Ваш заказ ${ref} готовится.`],
      order_ready: (ref) => ['Готово к выдаче', `Ваш заказ ${ref} ждёт вас горячим по адресу 53 bis Bd Arago.`],
      order_collected: (ref) => ['Buon appetito!', `Спасибо за заказ ${ref}. До встречи в Otto.`],
      order_cancelled: (ref) => ['Заказ отменён', `Ваш заказ ${ref} отменён.`],
      order_reminder: (ref) => ['Напоминание: скоро самовывоз', `Ваш заказ ${ref} скоро будет готов по адресу 53 bis Bd Arago. Оплата при получении.`],
    },
    extraLabels: { 'Parmesan': 'Пармезан', 'Burrata': 'Буррата', 'Bufala': 'Моцарелла из молока буйволицы', 'Stracciatella': 'Страчателла', 'Burratina': 'Бурратина', 'Jambon de Parme': 'Пармская ветчина', 'Version végétarienne': 'Вегетарианский вариант' },
    extrasPaid: 'Добавки',
    extrasFree: 'По запросу',
    extrasTitle: (dish) => `${dish} — на ваш вкус`,
    extrasGroups: { fromage: 'Сыр — на выбор один' },
    extrasAdd: (price) => `Добавить · ${price}`,
    extrasCancel: 'Отмена',
    plain: 'Без добавок',
    removeLine: (label) => `Убрать: ${label}`,
  },
  ja: {
    locale: 'ja-JP',
    dayNames: ['日', '月', '火', '水', '木', '金', '土'],
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    today: '今日',
    money: (n) => `€${n}`,
    articles: (n) => `${n}点`,
    cartEmpty: 'カートは空です',
    at: (date, time) => `${date} ${time}`,
    recapPickup: (p) => `受け取り：${p}`,
    summaryPickup: (p) => `受け取り ${p}`,
    summaryNoTime: '受け取り時間をお選びください',
    submitFailed: 'ご注文を登録できませんでした。もう一度お試しいただくか、09 87 14 08 50 までお電話ください。',
    errors: {
      slot_unavailable: 'その受け取り時間はご利用いただけなくなりました。別の時間をお選びください。',
      invalid_slot: 'その受け取り時間はご利用いただけなくなりました。別の時間をお選びください。',
      invalid_date: '有効な受け取り日をお選びください。',
      invalid_items: 'カートは空です。',
      unknown_item: 'カート内の料理のひとつがメニューから外れました。',
      invalid_quantity: 'カートの数量をご確認ください。',
      invalid_name: 'お名前をご入力ください。',
      invalid_email: '有効なメールアドレスをご入力ください。',
      invalid_phone: '有効な電話番号をご入力ください。',
      rate_limited: 'ご注文が集中しています。数分後にもう一度お試しください。',
      storage_full: 'この端末にご注文を保存できませんでした。',
      not_found: 'ご注文が見つかりません。',
      not_cancellable: 'オンラインでのキャンセル期限を過ぎました。09 87 14 08 50 までお電話ください。',
      invalid_extras: 'カート内のトッピングのひとつがご利用いただけなくなりました。',
      network: 'サーバーが応答していません。',
    },
    toastTitle: (name) => `${name} 様、のちほどお待ちしています！`,
    toastBody: ({ ref, lines, total, date, slot, email }) =>
      `ご注文 ${ref}：${lines} — ${total}（お受け取り時にお支払い）。${date} ${slot} に 53 bis Bd Arago でお待ちしています。確認メールを ${email} にお送りしました。`,
    status: { pending: '受付済み', confirmed: '確定', preparing: '焼成中', ready: '受け取り可', collected: '受け取り済み', cancelled: 'キャンセル' },
    cancel: 'キャンセル',
    confirmCancel: (ref) => `ご注文 ${ref} をキャンセルしますか？`,
    reorder: 'もう一度注文',
    historyActive: (a, p) => `進行中 ${a}件${p ? ` · 過去7日間 ${p}件` : ''}`,
    historyPast: '過去7日間',
    notice: {
      order_received: (ref) => ['ご注文を受け付けました', `ご注文 ${ref} を受け付けました。窯の準備ができ次第、確定のご連絡をします。`],
      order_confirmed: (ref) => ['ご注文が確定しました', `ご注文 ${ref} が確定しました。お受け取りは 53 bis Bd Arago です。`],
      order_preparing: (ref) => ['焼いています！', `ご注文 ${ref} を調理中です。`],
      order_ready: (ref) => ['カウンターでお受け取りいただけます', `ご注文 ${ref} が 53 bis Bd Arago で熱々のままお待ちしています。`],
      order_collected: (ref) => ['Buon appetito!', `ご注文 ${ref} ありがとうございました。またのご来店をお待ちしています。`],
      order_cancelled: (ref) => ['ご注文をキャンセルしました', `ご注文 ${ref} はキャンセルされました。`],
      order_reminder: (ref) => ['まもなくお受け取り時間です', `ご注文 ${ref} はまもなく 53 bis Bd Arago でご用意できます。お支払いはお受け取り時に。`],
    },
    extraLabels: { 'Parmesan': 'パルミジャーノ', 'Burrata': 'ブッラータ', 'Bufala': '水牛モッツァレラ', 'Stracciatella': 'ストラッチャテッラ', 'Burratina': 'ブッラティーナ', 'Jambon de Parme': 'パルマ産生ハム', 'Version végétarienne': 'ベジタリアン仕様' },
    extrasPaid: 'トッピング',
    extrasFree: 'ご希望で',
    extrasTitle: (dish) => `${dish}をお好みで`,
    extrasGroups: { fromage: 'チーズ（1種類お選びください）' },
    extrasAdd: (price) => `追加 · ${price}`,
    extrasCancel: 'キャンセル',
    plain: 'トッピングなし',
    removeLine: (label) => `削除：${label}`,
  },
  el: {
    locale: 'el-GR',
    dayNames: ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'],
    months: ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'],
    today: 'Σήμερα',
    money: (n) => `${n} €`,
    articles: (n) => `${n} ${n > 1 ? 'προϊόντα' : 'προϊόν'}`,
    cartEmpty: 'Το καλάθι σας είναι άδειο',
    at: (date, time) => `${date} στις ${time}`,
    recapPickup: (p) => `Παραλαβή ${p}`,
    summaryPickup: (p) => `παραλαβή ${p}`,
    summaryNoTime: 'επιλέξτε ώρα παραλαβής',
    submitFailed: 'Δεν ήταν δυνατή η καταχώριση της παραγγελίας. Δοκιμάστε ξανά ή καλέστε μας στο 09 87 14 08 50.',
    errors: {
      slot_unavailable: 'Αυτή η ώρα παραλαβής δεν είναι πλέον διαθέσιμη — επιλέξτε άλλη.',
      invalid_slot: 'Αυτή η ώρα παραλαβής δεν είναι πλέον διαθέσιμη — επιλέξτε άλλη.',
      invalid_date: 'Επιλέξτε έγκυρη ημερομηνία παραλαβής.',
      invalid_items: 'Το καλάθι σας είναι άδειο.',
      unknown_item: 'Ένα από τα πιάτα στο καλάθι σας δεν υπάρχει πλέον στο μενού.',
      invalid_quantity: 'Ελέγξτε τις ποσότητες στο καλάθι σας.',
      invalid_name: 'Συμπληρώστε το όνομά σας.',
      invalid_email: 'Συμπληρώστε έγκυρο email.',
      invalid_phone: 'Συμπληρώστε έγκυρο αριθμό τηλεφώνου.',
      rate_limited: 'Πάρα πολλές παραγγελίες — δοκιμάστε ξανά σε λίγα λεπτά.',
      storage_full: 'Δεν ήταν δυνατή η αποθήκευση της παραγγελίας σε αυτή τη συσκευή.',
      not_found: 'Η παραγγελία δεν βρέθηκε.',
      not_cancellable: 'Είναι αργά για ακύρωση online — καλέστε μας στο 09 87 14 08 50.',
      invalid_extras: 'Ένα από τα έξτρα στο καλάθι σας δεν είναι πλέον διαθέσιμο.',
      network: 'Ο διακομιστής δεν αποκρίνεται.',
    },
    toastTitle: (name) => `Τα λέμε σε λίγο, ${name}!`,
    toastBody: ({ ref, lines, total, date, slot, email }) =>
      `Παραγγελία ${ref}: ${lines} — ${total}, πληρωμή κατά την παραλαβή. Σας περιμένουμε ${date} στις ${slot}, στο 53 bis Bd Arago. Το email επιβεβαίωσης στάλθηκε στο ${email}.`,
    status: { pending: 'Ελήφθη', confirmed: 'Επιβεβαιώθηκε', preparing: 'Στον φούρνο', ready: 'Έτοιμη', collected: 'Παραλήφθηκε', cancelled: 'Ακυρώθηκε' },
    cancel: 'Ακύρωση',
    confirmCancel: (ref) => `Ακύρωση της παραγγελίας ${ref};`,
    reorder: 'Νέα παραγγελία',
    historyActive: (a, p) => `${a} σε εξέλιξη${p ? ` · ${p} τις τελευταίες 7 ημέρες` : ''}`,
    historyPast: 'Τελευταίες 7 ημέρες',
    notice: {
      order_received: (ref) => ['Η παραγγελία ελήφθη', `Η παραγγελία ${ref} ελήφθη — θα την επιβεβαιώσουμε μόλις είναι έτοιμος ο φούρνος.`],
      order_confirmed: (ref) => ['Η παραγγελία επιβεβαιώθηκε', `Η παραγγελία ${ref} επιβεβαιώθηκε — παραλαβή στο 53 bis Bd Arago.`],
      order_preparing: (ref) => ['Στον φούρνο!', `Η παραγγελία σας ${ref} ετοιμάζεται.`],
      order_ready: (ref) => ['Έτοιμη στον πάγκο', `Η παραγγελία σας ${ref} σας περιμένει ζεστή στο 53 bis Bd Arago.`],
      order_collected: (ref) => ['Buon appetito!', `Ευχαριστούμε για την παραγγελία ${ref}. Τα λέμε σύντομα στο Otto.`],
      order_cancelled: (ref) => ['Η παραγγελία ακυρώθηκε', `Η παραγγελία σας ${ref} ακυρώθηκε.`],
      order_reminder: (ref) => ['Υπενθύμιση: παραλαβή σε λίγο', `Η παραγγελία σας ${ref} θα είναι σύντομα έτοιμη στο 53 bis Bd Arago. Πληρωμή κατά την παραλαβή.`],
    },
    extraLabels: { 'Parmesan': 'Παρμεζάνα', 'Burrata': 'Μπουράτα', 'Bufala': 'Βουβαλίσια μοτσαρέλα', 'Stracciatella': 'Στρατσιατέλα', 'Burratina': 'Μπουρατίνα', 'Jambon de Parme': 'Προσούτο Πάρμας', 'Version végétarienne': 'Χορτοφαγική εκδοχή' },
    extrasPaid: 'Έξτρα',
    extrasFree: 'Κατόπιν αιτήματος',
    extrasTitle: (dish) => `${dish}, όπως σας αρέσει`,
    extrasGroups: { fromage: 'Τυρί — επιλέξτε ένα' },
    extrasAdd: (price) => `Προσθήκη · ${price}`,
    extrasCancel: 'Ακύρωση',
    plain: 'Χωρίς έξτρα',
    removeLine: (label) => `Αφαίρεση: ${label}`,
  },
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('order-form');
  if (!form) return;

  const T = ORDER_I18N[document.documentElement.lang] || ORDER_I18N.fr;
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
