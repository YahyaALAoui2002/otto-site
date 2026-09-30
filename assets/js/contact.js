// Otto — formulaire de contact (contact.html, en/contact.html).
// Validation côté client + confirmation ; l'envoi réel reste à brancher.

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  const toast = document.getElementById('contact-toast');
  if (!form || !toast) return;

  const en = document.documentElement.lang === 'en';
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
    document.getElementById('contact-toast-title').textContent = en ? `Thank you, ${name}.` : `Merci, ${name}.`;
    document.getElementById('contact-toast-body').textContent = en
      ? `Your message is on its way. We'll reply to ${form.elements.email.value} as soon as possible.`
      : `Votre message est bien parti. Nous vous répondrons à ${form.elements.email.value} dans les meilleurs délais.`;

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
