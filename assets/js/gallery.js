// Otto — photos page: category filters + lightbox.
// Progressive enhancement: without JS every tile is a plain link to the
// full-size photo, and all categories stay visible.

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.gallery-grid');
  if (!grid) return;
  const items = [...grid.querySelectorAll('.gallery-item')];
  const buttons = document.querySelectorAll('.gallery-filter');

  // Filters — hide non-matching tiles; grid-auto-flow: dense reflows the rest.
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      items.forEach((item) => {
        const show = filter === 'all' || item.dataset.cat === filter;
        item.hidden = !show;
        item.classList.remove('is-entering');
        if (show) {
          void item.offsetWidth; // restart the entrance animation
          item.classList.add('is-entering');
        }
      });
    });
  });

  // Lightbox — native <dialog>: focus trap, Esc to close and inert page come for free.
  const dialog = document.querySelector('.lightbox');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const img = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');
  let current = 0;

  // Link tiles (e.g. « Vente à emporter » → order page) navigate instead of opening the lightbox.
  const visible = () => items.filter((item) => !item.hidden && !item.classList.contains('gallery-item--link'));
  const show = (index) => {
    const list = visible();
    current = (index + list.length) % list.length;
    const source = list[current].querySelector('img');
    img.src = source.currentSrc || source.src;
    img.alt = source.alt;
    caption.textContent = source.alt;
  };

  grid.addEventListener('click', (event) => {
    const link = event.target.closest('.gallery-item a');
    if (!link || link.parentElement.classList.contains('gallery-item--link')) return;
    event.preventDefault();
    show(visible().indexOf(link.parentElement));
    dialog.showModal();
  });

  dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // click on the dark backdrop area
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });

  // Touch swipe
  let startX = null;
  dialog.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  dialog.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    startX = null;
  });
});
