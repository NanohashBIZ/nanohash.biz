// Swaps English copy into elements marked with data-i18n*. Thai lives in the HTML and is captured on load.
(() => {
  const KEY = 'nanohash-lang';
  const LANGS = ['th', 'en'];
  const en = (window.NH_COPY && window.NH_COPY.en) || {};
  const root = document.documentElement;
  const original = new Map();

  const keep = (el, prop, value) => {
    let saved = original.get(el);
    if (!saved) original.set(el, saved = {});
    if (!(prop in saved)) saved[prop] = value;
  };
  const value = (lang, el, prop, key) => {
    if (lang === 'th') return original.get(el)[prop];
    if (key in en) return en[key];
    console.warn(`nh-i18n: no English text for "${key}"`);
    return original.get(el)[prop];
  };
  const attrPairs = el => el.dataset.i18nAttr.split(';').map(p => p.split(':').map(s => s.trim())).filter(p => p[0] && p[1]);

  document.querySelectorAll('[data-i18n]').forEach(el => keep(el, 'text', el.textContent));
  document.querySelectorAll('[data-i18n-html]').forEach(el => keep(el, 'html', el.innerHTML));
  document.querySelectorAll('[data-i18n-src]').forEach(el => keep(el, 'src', el.getAttribute('src')));
  document.querySelectorAll('[data-i18n-attr]').forEach(el => attrPairs(el).forEach(([a]) => keep(el, a, el.getAttribute(a))));

  function set(lang) {
    if (!LANGS.includes(lang)) lang = 'th';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = value(lang, el, 'text', el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = value(lang, el, 'html', el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-src]').forEach(el => { el.setAttribute('src', value(lang, el, 'src', el.dataset.i18nSrc)); });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => attrPairs(el).forEach(([a, key]) => el.setAttribute(a, value(lang, el, a, key))));
    root.lang = lang;
    document.querySelectorAll('.nh-lang [data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    try { localStorage.setItem(KEY, lang); } catch (e) { /* storage unavailable */ }
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) { url.searchParams.set('lang', lang); history.replaceState(null, '', url); }
    api.lang = lang;
    root.classList.remove('nh-i18n-pending');
    document.dispatchEvent(new CustomEvent('nh:lang', { detail: lang }));
  }

  function initial() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(fromUrl)) return fromUrl;
    try { const saved = localStorage.getItem(KEY); if (LANGS.includes(saved)) return saved; } catch (e) { /* use default */ }
    return 'th';
  }

  const api = { lang: 'th', set };
  window.NH_I18N = api;
  document.querySelectorAll('.nh-lang [data-lang]').forEach(b => b.addEventListener('click', () => set(b.dataset.lang)));
  set(initial());
})();
