// Otto — nav, mobile menu, motif reveal-on-scroll, entrance reveal.
// Vanilla JS, no framework (per docs/01 §9: static site, no CMS/build step,
// Yframe manages content updates).

// Entrance reveal — Otto wordmark curtain. The skip decision (already seen
// this tab session, or prefers-reduced-motion) happens in a tiny inline
// script right next to the markup in the HTML, synchronously, before the
// curtain can paint — see the <script> right after .site-reveal. This part
// only cleans up once the curtain has actually played: removes it from the
// DOM after its own animation ends, so it stops sitting in the tab order.
// A hard timeout backs up the animationend listener — a throttled tab or a
// dropped animation frame must never leave the curtain stuck over the site.
document.addEventListener('DOMContentLoaded', () => {
  const reveal = document.querySelector('.site-reveal');
  if (reveal && document.documentElement.classList.contains('is-revealing')) {
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      document.documentElement.classList.remove('is-revealing');
      reveal.remove();
    };
    reveal.addEventListener('animationend', (event) => {
      if (event.target === reveal) dismiss(); // ignore the inner wordmark's own animation
    });
    setTimeout(dismiss, 2200); // curtain animation finishes at 1.8s — safety net only
  }

  const toggle = document.querySelector('.nav-toggle');
  const panel = document.querySelector('.nav-mobile-panel');
  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Motif reveal — docs/03 §3: one-time stroke-in, no repeat on re-scroll.
  const motifs = document.querySelectorAll('.motif');
  if (motifs.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    motifs.forEach((el) => observer.observe(el));
  } else {
    motifs.forEach((el) => el.classList.add('is-visible'));
  }

  // Reviews marquee — the card set is already duplicated in the HTML and the
  // CSS animation (translateX 0 → -50%, pause on :hover/:focus-within) runs
  // on its own, so this always slides even if JS fails to load. This just
  // fine-tunes the animation duration so the crawl speed (px/s) stays
  // constant no matter how wide the actual card content ends up.
  const reviewsTrack = document.querySelector('.reviews-track');
  if (reviewsTrack) {
    const PX_PER_SECOND = 100; // brisk, clearly-moving crawl (was 60, originally 40)
    const setDuration = () => {
      const halfWidth = reviewsTrack.scrollWidth / 2;
      reviewsTrack.style.setProperty('--marquee-duration', `${halfWidth / PX_PER_SECOND}s`);
    };
    setDuration();
    window.addEventListener('resize', setDuration);
  }
});
