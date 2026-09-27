// Shows the install steps in a panel at the bottom of the page when a download starts.
// The download itself is not blocked. Click outside, press Esc or the close button to hide it.
(() => {
  const copy = {
    th: {
      title: 'ติดตั้งใน 4 ขั้นตอน',
      downloading: 'กำลังดาวน์โหลด',
      close: 'ปิด',
      step: 'ขั้นที่',
      more: 'ดูวิธีติดตั้งแบบละเอียด',
      s1: ['เปิดไฟล์ที่ดาวน์โหลด', 'คลิกไฟล์ที่มุมขวาบนของเบราว์เซอร์ หรือในโฟลเดอร์ Downloads'],
      done: 'เสร็จแล้ว',
      s2: ['กด "More info"', 'ถ้า Windows ขึ้นหน้าจอสีแดง ให้กดข้อความนี้ใต้คำเตือน'],
      s3: ['เช็กชื่อไฟล์ แล้วกด "Run anyway"', 'ช่อง App ต้องเป็นชื่อไฟล์เดียวกับที่ดาวน์โหลด'],
      s4tidy: ['กด "Yes"', 'Windows จะขอสิทธิ์ผู้ดูแลเพื่อติดตั้ง TidyUp PC กด Yes แล้วรอจนติดตั้งเสร็จ'],
      s4pdf: ['ติดตั้งเสร็จ พร้อมใช้', 'NanoPDF ติดตั้งให้เองโดยไม่ต้องใช้สิทธิ์ผู้ดูแล เปิดได้จาก Start menu'],
      s4share: ['ติดตั้งเสร็จ พร้อมส่ง', 'NanoShare ติดตั้งให้เองโดยไม่ต้องใช้สิทธิ์ผู้ดูแล เปิดได้จาก Start menu หรือไอคอนมุมขวาล่าง'],
    },
    en: {
      title: 'Install in 4 steps',
      downloading: 'Downloading',
      close: 'Close',
      step: 'Step',
      more: 'See the full install guide',
      s1: ['Open the downloaded file', 'Click the file at the top right of your browser, or in your Downloads folder'],
      done: 'Done',
      s2: ['Click "More info"', 'If Windows shows a red screen, click this link below the warning'],
      s3: ['Check the name, then "Run anyway"', 'The App line must match the file you downloaded'],
      s4tidy: ['Click "Yes"', 'Windows asks for administrator permission to install TidyUp PC. Click Yes and wait for setup to finish'],
      s4pdf: ['Installed and ready', 'NanoPDF installs itself without administrator rights. Open it from the Start menu'],
      s4share: ['Installed and ready to send', 'NanoShare installs itself without administrator rights. Open it from the Start menu or the icon at the bottom right'],
    },
  };
  let panel = null;
  let lastFocus = null;

  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function build(file) {
    const t = copy[document.documentElement.lang === 'en' ? 'en' : 'th'];
    const tidy = /tidy/i.test(file);
    const share = /share/i.test(file);
    const s4 = tidy ? t.s4tidy : share ? t.s4share : t.s4pdf;
    const card = (n, [title, text], visual) =>
      `<li class="nh-ig-card"><p class="nh-ig-step">${t.step} ${n}</p><h3>${esc(title)}</h3><div class="nh-ig-visual">${visual}</div><p class="nh-ig-text">${esc(text)}</p></li>`;
    const chip = `<div class="nh-ig-chip"><img src="img/favicon-64.png" alt="" width="28" height="28"><span><b>${esc(file)}</b><small>${t.done}</small></span></div>`;
    const shot = (src, ring) => `<div class="nh-shot nh-shot--ring nh-ig-shot"><img src="${src}" alt="" width="529" height="495"><span class="nh-ring" style="${ring}"></span></div>`;
    const finish = tidy
      ? `<div class="nh-ig-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6zM9 12l2 2 4-4"/></svg><span>Yes</span></div>`
      : `<div class="nh-ig-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>${share ? 'NanoShare' : 'NanoPDF'}</span></div>`;

    const el = document.createElement('div');
    el.className = 'nh-ig';
    el.innerHTML = `<div class="nh-ig-backdrop"></div>
      <section class="nh-ig-panel" role="dialog" aria-modal="true" aria-labelledby="nh-ig-title">
        <header class="nh-ig-head">
          <div><p class="nh-ig-kicker">${t.downloading} ${esc(file)}</p><h2 id="nh-ig-title">${t.title}</h2></div>
          <button type="button" class="nh-ig-close" aria-label="${t.close}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg></button>
        </header>
        <ol class="nh-ig-cards">
          ${card(1, t.s1, chip)}
          ${card(2, t.s2, shot('img/install/smartscreen-1.png', 'left:2.5%;top:22.5%;width:15%;height:7%'))}
          ${card(3, t.s3, shot('img/install/smartscreen-2.png', 'left:51.5%;top:87.5%;width:21.5%;height:9%'))}
          ${card(4, s4, finish)}
        </ol>
        <a class="nh-ig-more" href="install.html">${t.more} →</a>
      </section>`;
    return el;
  }

  function close() {
    if (!panel) return;
    const p = panel;
    panel = null;
    p.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => p.remove(), 250);
    if (lastFocus) lastFocus.focus();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function open(file) {
    close();
    lastFocus = document.activeElement;
    panel = build(file);
    document.body.appendChild(panel);
    panel.querySelector('.nh-ig-backdrop').addEventListener('click', close);
    panel.querySelector('.nh-ig-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    void panel.offsetHeight; // commit the closed state so the slide-in transition runs
    panel.classList.add('is-open');
    panel.querySelector('.nh-ig-close').focus({ preventScroll: true });
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="/download/"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const file = a.getAttribute('href').split('/').pop();
    // let the browser start the download first, then show the steps
    setTimeout(() => open(file), 150);
  });
})();
