// Fades sections in as they scroll into view. Content is visible without this script.
(() => {
  const items = document.querySelectorAll('.nh-reveal');
  const show = el => el.classList.add('is-in');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { items.forEach(show); return; }
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach(el => io.observe(el));
})();
