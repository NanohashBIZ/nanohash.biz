// Fades sections in as they scroll into view. Content is visible without this script.
(() => {
  const items = document.querySelectorAll('.nh-reveal');
  const show = el => el.classList.add('is-in');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { items.forEach(show); return; }
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach(el => io.observe(el));
})();

// Hero: the product screenshots swap places every few seconds. Pauses on hover, off screen and for reduced motion.
(() => {
  const box = document.querySelector('.nh-hero-shots');
  if (!box || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const shots = [...box.querySelectorAll('.nh-shot')];
  if (shots.length < 2) return;
  let step = 0;
  let hover = false;
  let visible = true;
  const place = () => shots.forEach((el, i) => { el.dataset.slot = String((i + step) % shots.length); });
  place();
  box.addEventListener('mouseenter', () => { hover = true; });
  box.addEventListener('mouseleave', () => { hover = false; });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(box);
  setInterval(() => {
    if (hover || !visible || document.hidden) return;
    step = (step + shots.length - 1) % shots.length;
    place();
  }, 4200);
})();
