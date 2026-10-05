// Otto — formulaire de contact (contact.html et chaque <langue>/contact.html).
// Validation côté client + confirmation ; l'envoi réel reste à brancher.

const CONTACT_I18N = {
  fr: { title: (name) => `Merci, ${name}.`, body: (email) => `Votre message est bien parti. Nous vous répondrons à ${email} dans les meilleurs délais.` },
  en: { title: (name) => `Thank you, ${name}.`, body: (email) => `Your message is on its way. We'll reply to ${email} as soon as possible.` },
  it: { title: (name) => `Grazie, ${name}.`, body: (email) => `Il vostro messaggio è partito. Vi risponderemo a ${email} il prima possibile.` },
  es: { title: (name) => `Gracias, ${name}.`, body: (email) => `Su mensaje se ha enviado. Le responderemos a ${email} lo antes posible.` },
  de: { title: (name) => `Danke, ${name}.`, body: (email) => `Ihre Nachricht ist unterwegs. Wir antworten Ihnen so schnell wie möglich an ${email}.` },
  pl: { title: (name) => `Dziękujemy, ${name}.`, body: (email) => `Wiadomość została wysłana. Odpowiemy na ${email} najszybciej, jak to możliwe.` },
  zh: { title: (name) => `谢谢，${name}。`, body: (email) => `您的留言已发送。我们会尽快回复至 ${email}。` },
  ru: { title: (name) => `Спасибо, ${name}.`, body: (email) => `Ваше сообщение отправлено. Мы ответим на ${email} как можно скорее.` },
  ja: { title: (name) => `${name} 様、ありがとうございます。`, body: (email) => `メッセージを送信しました。${email} にできるだけ早くご返信します。` },
  el: { title: (name) => `Ευχαριστούμε, ${name}.`, body: (email) => `Το μήνυμά σας στάλθηκε. Θα σας απαντήσουμε στο ${email} το συντομότερο δυνατό.` },
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  const toast = document.getElementById('contact-toast');
  if (!form || !toast) return;

  const T = CONTACT_I18N[document.documentElement.lang] || CONTACT_I18N.fr;
  const fields = [...form.querySelectorAll('.resa-field input[required], .resa-field textarea[required]')];

  fields.forEach((f) => {
    f.addEventListener('input', () => { if (f.checkValidity()) f.classList.remove('is-invalid'); });
  });

  let lastFocus = null;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    fields.forEach((f) => f.classList.toggle('is-invalid', !f.value.trim() || !f.checkValidity()));
    const firstBad = fields.find((f) => f.classList.contains('is-invalid'));
    if (firstBad) {
      firstBad.focus();
      return;
    }

    const name = form.elements.firstname.value.trim();
    document.getElementById('contact-toast-title').textContent = T.title(name);
    document.getElementById('contact-toast-body').textContent = T.body(form.elements.email.value);

    lastFocus = document.activeElement;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-open'));
    document.getElementById('contact-toast-close').focus();
  });

  const closeToast = () => {
    toast.classList.remove('is-open');
    toast.hidden = true;
    form.reset();
    if (lastFocus) lastFocus.focus();
  };
  document.getElementById('contact-toast-close').addEventListener('click', closeToast);
  toast.addEventListener('click', (e) => { if (e.target === toast) closeToast(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !toast.hidden) closeToast(); });
});
