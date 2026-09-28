// NanoBot, the site mascot in the bottom-right corner: blinks, looks around (follows the mouse), waves,
// and opens a small help menu. The picture is one render cut into layers (img/nanobot/*), moved with CSS.
(() => {
  if (document.querySelector('.nh-bot')) return;
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode: just forget */ } },
  };
  if (store.get('nanobot-hidden')) return;

  const COPY = {
    th: {
      label: 'NanoBot ผู้ช่วยของ NanoHash เปิดเมนูช่วยเหลือ',
      hello: 'สวัสดีครับ ผม NanoBot มีอะไรให้ช่วยไหมครับ',
      title: 'สวัสดีครับ ผม NanoBot',
      lead: 'อยากทำอะไร เลือกได้เลยครับ',
      install: 'ดาวน์โหลดโปรแกรม',
      buy: 'ซื้อ License',
      account: 'บัญชีและ License ของฉัน',
      mail: 'ติดต่อทีมงาน',
      mailNote: 'support@nanohash.biz',
      close: 'ปิดเมนู',
      hide: 'ซ่อน NanoBot',
    },
    en: {
      label: 'NanoBot, the NanoHash helper. Open the help menu',
      hello: "Hi, I'm NanoBot. Need a hand?",
      title: "Hi, I'm NanoBot",
      lead: 'What would you like to do?',
      install: 'Download our apps',
      buy: 'Buy a License',
      account: 'My account and Licenses',
      mail: 'Contact our team',
      mailNote: 'support@nanohash.biz',
      close: 'Close menu',
      hide: 'Hide NanoBot',
    },
  };
  const LINKS = [
    { key: 'install', href: '/install#download', icon: 'M12 3v12m0 0-5-5m5 5 5-5M4 19h16' },
    { key: 'buy', href: '/account#buy', icon: 'M3 6h18l-2 11H5L3 6Zm4 0 1-3h8l1 3M9 11h6' },
    { key: 'account', href: '/account', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0' },
    { key: 'mail', href: 'mailto:support@nanohash.biz', icon: 'M3 6h18v12H3V6Zm0 0 9 7 9-7' },
  ];
  const IMG = '/img/nanobot/';
  const layer = (name, cls) => `<img class="nh-bot-l ${cls || ''}" src="${IMG}${name}.webp" alt="" draggable="false">`;

  const el = document.createElement('div');
  el.className = 'nh-bot';
  el.setAttribute('translate', 'no');
  el.innerHTML = `
    <div class="nh-bot-bubble" aria-hidden="true"></div>
    <div class="nh-bot-panel" id="nh-bot-panel" role="dialog" aria-labelledby="nh-bot-title" hidden>
      <button type="button" class="nh-bot-x" data-bot="close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <p class="nh-bot-title" id="nh-bot-title"></p>
      <p class="nh-bot-lead"></p>
      <ul class="nh-bot-menu">${LINKS.map(l => `
        <li><a href="${l.href}" data-key="${l.key}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${l.icon}"/></svg><span></span></a></li>`).join('')}
      </ul>
      <button type="button" class="nh-bot-hide" data-bot="hide"></button>
    </div>
    <button type="button" class="nh-bot-btn" aria-expanded="false" aria-controls="nh-bot-panel">
      <span class="nh-bot-shadow" aria-hidden="true"></span>
      <span class="nh-bot-float" aria-hidden="true"><span class="nh-bot-body">
        ${layer('base')}${layer('arm', 'nh-bot-arm')}
        <span class="nh-bot-face">${layer('face')}${layer('eye-l', 'nh-bot-eye nh-bot-eye--l')}${layer('eye-r', 'nh-bot-eye nh-bot-eye--r')}</span>
      </span></span>
    </button>`;

  const $ = s => el.querySelector(s);
  const btn = $('.nh-bot-btn');
  const panel = $('.nh-bot-panel');
  const bubble = $('.nh-bot-bubble');
  const body = $('.nh-bot-body');

  function text() {
    const t = COPY[root.lang === 'en' ? 'en' : 'th'];
    btn.setAttribute('aria-label', t.label);
    bubble.textContent = t.hello;
    $('.nh-bot-title').textContent = t.title;
    $('.nh-bot-lead').textContent = t.lead;
    $('.nh-bot-x').setAttribute('aria-label', t.close);
    $('.nh-bot-hide').textContent = t.hide;
    el.querySelectorAll('.nh-bot-menu a').forEach(a => {
      a.querySelector('span').innerHTML = a.dataset.key === 'mail'
        ? `${t.mail}<small>${t.mailNote}</small>` : t[a.dataset.key];
    });
  }
  text();
  new MutationObserver(text).observe(root, { attributes: true, attributeFilter: ['lang'] });

  // ---- moves ----
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const awake = () => !document.hidden && !still.matches;

  function look(x, y) {
    body.style.setProperty('--look-x', x.toFixed(3));
    body.style.setProperty('--look-y', y.toFixed(3));
  }
  function wave() {
    if (still.matches) return;
    el.classList.remove('is-waving');
    void el.offsetWidth;  // restart the animation
    el.classList.add('is-waving');
  }
  $('.nh-bot-arm').addEventListener('animationend', () => el.classList.remove('is-waving'));

  function blink() {
    if (awake()) {
      el.classList.add('is-blink');
      setTimeout(() => el.classList.remove('is-blink'), 150);
      if (Math.random() < 0.2) setTimeout(() => { el.classList.add('is-blink'); setTimeout(() => el.classList.remove('is-blink'), 140); }, 320);
    }
    later(blink, rand(2600, 5600));
  }

  let mouseAt = 0;
  function idleLook() {
    if (awake() && Date.now() - mouseAt > 2500 && panel.hidden) {
      const spots = [[0, 0], [-1, 0.1], [1, 0.1], [-0.6, -0.5], [0.6, -0.4], [0.4, 0.5], [-0.4, 0.4]];
      const [x, y] = spots[Math.floor(Math.random() * spots.length)];
      look(x, y);
    }
    later(idleLook, rand(1800, 4200));
  }

  // look toward the mouse while it moves
  let frame = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || still.matches || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width * 0.45);
      const dy = e.clientY - (r.top + r.height * 0.3);
      const clamp = v => Math.max(-1, Math.min(1, v));
      mouseAt = Date.now();
      look(clamp(dx / 380), clamp(dy / 320));
    });
  }, { passive: true });

  // ---- greeting bubble ----
  function say(ms = 5200) {
    el.classList.add('is-talking');
    later(() => el.classList.remove('is-talking'), ms);
  }

  // ---- help menu ----
  function open(byKeyboard) {
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    el.classList.add('is-open');
    el.classList.remove('is-talking');
    look(-0.7, -0.6);  // look up at the menu
    wave();
    // a mouse click leaves focus on NanoBot, so no menu item looks already chosen
    if (byKeyboard) $('.nh-bot-menu a').focus({ preventScroll: true });
  }
  function close(focusBtn) {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    el.classList.remove('is-open');
    look(0, 0);
    if (focusBtn) btn.focus({ preventScroll: true });
  }
  btn.addEventListener('click', e => (panel.hidden ? open(e.detail === 0) : close()));
  btn.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && panel.hidden) wave(); });
  el.addEventListener('click', e => {
    // a link to a part of this same page (e.g. the download cards on /install): scroll there instead of reloading
    const a = e.target.closest('.nh-bot-menu a');
    if (a && a.hash && a.pathname.replace(/\.html$/, '') === location.pathname.replace(/\.html$/, '')) {
      const target = document.querySelector(a.hash);
      if (target) {
        e.preventDefault();
        close(false);
        target.scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth', block: 'center' });
        target.querySelector('a, button')?.focus({ preventScroll: true });
        return;
      }
    }
    const act = e.target.closest('[data-bot]')?.dataset.bot;
    if (act === 'close') close(true);
    if (act === 'hide') {
      store.set('nanobot-hidden', '1');
      timers.forEach(clearTimeout);
      el.remove();
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(true); });
  document.addEventListener('pointerdown', e => { if (!el.contains(e.target)) close(false); });

  // ---- start once the body layer has loaded, so the parts never show half-drawn ----
  document.body.append(el);
  const base = el.querySelector('.nh-bot-l');
  const ready = () => {
    el.classList.add('is-in');
    later(blink, 1800);
    later(idleLook, 2400);
    if (!store.get('nanobot-greeted')) {
      store.set('nanobot-greeted', '1');
      later(() => { wave(); say(); }, 1300);
    }
  };
  if (base.complete && base.naturalWidth) ready(); else base.addEventListener('load', ready, { once: true });
})();
