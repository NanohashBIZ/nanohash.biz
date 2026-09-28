// Account page: signs in with Google (server side), lists License Keys and support requests.
(() => {
  const T = {
    th: {
      product: { tidyup: 'TidyUp PC', nanopdf: 'NanoPDF' },
      never: 'ใช้ได้ตลอด', expires: 'ใช้ได้ถึง', expired: 'หมดอายุแล้ว', issued: 'ออกให้เมื่อ',
      copy: 'คัดลอก', copied: 'คัดลอกแล้ว', all: 'ทั้งหมด', manage: 'จัดการ', pcs: (n, max) => `${n}/${max} เครื่อง`,
      noLicenses: 'ยังไม่มี License Key ในบัญชีนี้ ถ้าสนับสนุนเราแล้ว แจ้งได้ในฟอร์มด้านล่าง',
      machines: (n, max) => `เครื่องที่ใช้ Key นี้ ${n}/${max}`, noMachines: 'ยังไม่ได้ใส่ Key นี้ในเครื่องไหน',
      firstUsed: 'เริ่มใช้', lastSeen: 'ใช้ล่าสุด', removeMachine: 'เอาเครื่องนี้ออก',
      confirmRemove: name => `เอา ${name} ออกจาก Key นี้?\n\nเครื่องนั้นจะกลับเป็นยังไม่ได้เปิดใช้ภายใน 7 วัน และใส่ Key นี้ในเครื่องใหม่แทนได้`,
      noRequests: 'ยังไม่มีคำขอ',
      status: { pending: 'รอตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ' },
      toStripe: 'กำลังไปหน้าชำระเงิน…', paidOk: 'ชำระเงินเรียบร้อย License Key อยู่ในรายการด้านบนแล้ว ขอบคุณที่สนับสนุนเรา',
      paidWait: 'ได้รับการชำระเงินแล้ว กำลังออก License Key รีเฟรชหน้านี้อีกครั้งในอีกสักครู่', payCancelled: 'ยกเลิกการชำระเงินแล้ว ยังไม่มีการตัดเงิน',
      payNotDone: 'ยังไม่ได้รับการชำระเงิน ถ้าจ่ายด้วย PromptPay อาจใช้เวลาสักครู่',
      nsFree: 'บัญชีนี้ส่งไฟล์ใน NanoShare ได้ครั้งละ 1 GB', nsSupporter: 'คุณเป็นผู้สนับสนุน NanoShare ส่งไฟล์ได้ไม่จำกัด ขอบคุณมาก',
      nsPaid: 'ขอบคุณที่สนับสนุน NanoShare ตอนนี้ส่งได้ไม่จำกัดแล้ว กด “เปิด NanoShare ด้วยบัญชีนี้” หรือเข้าสู่ระบบในโปรแกรมอีกครั้ง',
      ref: 'อ้างอิง', slip: 'แนบสลิปแล้ว', sent: 'ส่งคำขอแล้ว เราจะตรวจสอบและแจ้งผลในหน้านี้', sending: 'กำลังส่ง…',
      errors: {
        cancelled: 'ยกเลิกการเข้าสู่ระบบแล้ว', state: 'การเข้าสู่ระบบหมดเวลา ลองใหม่อีกครั้ง',
        google: 'เข้าสู่ระบบกับ Google ไม่สำเร็จ ลองใหม่อีกครั้ง', email: 'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล',
        setup: 'ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน', load: 'โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้า',
        name: 'ใส่ชื่อที่จะแสดงใน License Key', proof: 'ใส่เลขอ้างอิงหรือแนบสลิปอย่างใดอย่างหนึ่ง',
        slip_size: 'ไฟล์สลิปใหญ่เกิน 2 MB', slip_type: 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF',
        too_many_pending: 'มีคำขอรอตรวจสอบอยู่แล้ว 3 รายการ รอผลก่อนนะ', too_many: 'ส่งคำขอบ่อยเกินไป ลองใหม่พรุ่งนี้',
        signed_out: 'หมดเวลาการเข้าสู่ระบบ เข้าสู่ระบบอีกครั้ง', other: 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง',
        payments_off: 'ระบบชำระเงินยังไม่เปิดใช้งาน', server: 'ระบบชำระเงินขัดข้อง ลองใหม่อีกครั้ง',
      },
    },
    en: {
      product: { tidyup: 'TidyUp PC', nanopdf: 'NanoPDF' },
      never: 'Lifetime', expires: 'Valid until', expired: 'Expired', issued: 'Issued',
      copy: 'Copy', copied: 'Copied', all: 'All', manage: 'Manage', pcs: (n, max) => `${n}/${max} PCs`,
      noLicenses: 'No License Keys in this account yet. If you have supported us, tell us in the form below.',
      machines: (n, max) => `PCs using this key ${n}/${max}`, noMachines: 'Not entered on any PC yet',
      firstUsed: 'Since', lastSeen: 'Last seen', removeMachine: 'Remove this PC',
      confirmRemove: name => `Remove ${name} from this key?\n\nThat PC goes back to not activated within 7 days, and you can enter the key on a new PC instead.`,
      noRequests: 'No requests yet',
      status: { pending: 'Being checked', approved: 'Approved', rejected: 'Not approved' },
      toStripe: 'Opening the payment page…', paidOk: 'Payment complete. Your License Key is in the list above. Thank you for supporting us.',
      paidWait: 'Payment received. Your License Key is being issued; refresh this page in a moment.', payCancelled: 'Payment cancelled. You have not been charged.',
      payNotDone: 'Payment not received yet. PromptPay payments can take a moment.',
      nsFree: 'This account can send 1 GB at a time in NanoShare', nsSupporter: 'You support NanoShare: unlimited sending. Thank you!',
      nsPaid: 'Thank you for supporting NanoShare. Unlimited sending is on: tap “Open NanoShare with this account”, or sign in again in the app.',
      ref: 'Reference', slip: 'Slip attached', sent: 'Request sent. We will check it and show the result here.', sending: 'Sending…',
      errors: {
        cancelled: 'Sign-in was cancelled.', state: 'Sign-in timed out. Please try again.',
        google: 'Could not sign in with Google. Please try again.', email: 'This Google account has not verified its email.',
        setup: 'Sign-in is not available yet.', load: 'Could not load your data. Try refreshing the page.',
        name: 'Enter the name to show in the License Key.', proof: 'Enter a reference number or attach a slip.',
        slip_size: 'The slip file is larger than 2 MB.', slip_type: 'Only JPG, PNG, WebP or PDF files are accepted.',
        too_many_pending: 'You already have 3 requests being checked. Please wait for the result.', too_many: 'Too many requests. Please try again tomorrow.',
        signed_out: 'Your session has ended. Please sign in again.', other: 'Could not send. Please try again.',
        payments_off: 'Payments are not available yet.', server: 'The payment system had a problem. Please try again.',
      },
    },
  };
  const t = () => T[document.documentElement.lang === 'en' ? 'en' : 'th'];
  const $ = id => document.getElementById(id);
  const state = { user: null, licenses: [], requests: [], error: null };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const date = iso => new Date(iso).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const today = () => new Date().toISOString().slice(0, 10);

  async function api(path, opts) {
    const res = await fetch(path, { credentials: 'same-origin', ...opts });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error || 'other'), { status: res.status, code: body.error || 'other' });
    return body;
  }

  function showAlert(code) {
    const box = $('acc-alert');
    const msg = code && (t().errors[code] || t().errors.other);
    box.hidden = !msg;
    box.textContent = msg || '';
  }

  function renderLicenses() {
    const list = $('acc-licenses');
    list.replaceChildren();
    if (!state.licenses.length) { list.append(el('p', 'nh-acc-empty', t().noLicenses)); return; }

    // filter chips once there is more than one product
    const counts = {};
    for (const l of state.licenses) counts[l.product] = (counts[l.product] || 0) + 1;
    const products = Object.keys(counts);
    if (state.licFilter && !counts[state.licFilter]) state.licFilter = '';
    if (products.length > 1) {
      const bar = el('div', 'nh-lic-filter');
      bar.setAttribute('role', 'group');
      const chip = (value, label, n) => {
        const b = el('button', 'nh-lic-chip', `${label} ${n}`);
        b.type = 'button';
        b.setAttribute('aria-pressed', String((state.licFilter || '') === value));
        b.addEventListener('click', () => { state.licFilter = value; renderLicenses(); });
        return b;
      };
      bar.append(chip('', t().all, state.licenses.length), ...products.map(p => chip(p, t().product[p] || p, counts[p])));
      list.append(bar);
    }

    const shown = state.licenses.filter(l => !state.licFilter || l.product === state.licFilter);
    const box = el('div', 'nh-lic-list');
    for (const lic of shown) box.append(licenseRow(lic));
    list.append(box);
  }

  function licenseRow(lic) {
    const max = state.maxMachines || 2;
    const used = (lic.machines || []).length;
    const expired = lic.exp !== 'never' && lic.exp < today();
    const row = el('details', 'nh-lic');
    if (state.openLic === lic.id) row.open = true;
    row.addEventListener('toggle', () => { state.openLic = row.open ? lic.id : (state.openLic === lic.id ? null : state.openLic); });

    const sum = el('summary', 'nh-lic-sum');
    const id = el('div', 'nh-lic-id');
    const title = el('strong', 'nh-acc-prod');
    title.append(el('i', `nh-dl-dot nh-dl-dot--${lic.product === 'tidyup' ? 'tidy' : 'pdf'}`), t().product[lic.product] || lic.product);
    id.append(title, el('small', null, `${lic.name} · ${keyPreview(lic.license_key)}`));
    const exp = el('span', `nh-acc-badge${expired ? ' is-bad' : ' is-ok'}`,
      lic.exp === 'never' ? t().never : expired ? `${t().expired} ${date(lic.exp)}` : `${t().expires} ${date(lic.exp)}`);
    const pcs = el('span', `nh-lic-pcs${used >= max ? ' is-full' : ''}`, t().pcs(used, max));
    const copy = copyButton(lic.license_key, 'nh-btn--secondary');
    copy.addEventListener('click', e => e.preventDefault()); // do not toggle the row
    const more = el('span', 'nh-lic-more', t().manage);
    sum.append(id, exp, pcs, copy, more);

    const body = el('div', 'nh-lic-body');
    const key = el('code', 'nh-acc-key', lic.license_key);
    body.append(el('p', 'nh-acc-meta', `${lic.email} · ${t().issued} ${date(lic.created_at)}`), key, machineList(lic));
    row.append(sum, body);
    return row;
  }

  const keyPreview = k => (k.length > 18 ? `${k.slice(0, 8)}…${k.slice(-6)}` : k);

  function copyButton(text, cls) {
    const b = el('button', `nh-btn ${cls} nh-btn--small`, t().copy);
    b.type = 'button';
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); } catch { return; }
      b.textContent = t().copied;
      setTimeout(() => { b.textContent = t().copy; }, 1800);
    });
    return b;
  }

  function machineList(lic) {
    const box = el('div', 'nh-acc-machines');
    const list = lic.machines || [];
    box.append(el('p', 'nh-acc-machines-title', t().machines(list.length, state.maxMachines || 2)));
    if (!list.length) box.append(el('p', 'nh-acc-meta', t().noMachines));
    for (const m of list) {
      const row = el('div', 'nh-acc-machine');
      const who = el('div', 'nh-acc-machine-who');
      who.append(el('strong', null, m.name), el('small', null, `${t().firstUsed} ${date(m.created_at)} · ${t().lastSeen} ${date(m.last_seen)}`));
      const rm = el('button', 'nh-btn nh-btn--secondary nh-btn--small', t().removeMachine);
      rm.type = 'button';
      rm.addEventListener('click', async () => {
        if (!confirm(t().confirmRemove(m.name))) return;
        rm.disabled = true;
        try {
          await api(`/api/machines/${m.id}/remove`, { method: 'POST' });
          const lic2 = await api('/api/licenses');
          state.licenses = lic2.licenses;
          renderLicenses();
        } catch (err) {
          rm.disabled = false;
          showAlert(err.code);
        }
      });
      row.append(who, rm);
      box.append(row);
    }
    return box;
  }

  function selectText(node) {
    const r = document.createRange();
    r.selectNodeContents(node);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  function renderRequests() {
    const list = $('acc-requests');
    list.replaceChildren();
    if (!state.requests.length) { list.append(el('p', 'nh-acc-empty', t().noRequests)); return; }
    for (const r of state.requests) {
      const row = el('article', 'nh-acc-item nh-acc-req');
      const head = el('div', 'nh-acc-item-head');
      head.append(el('strong', 'nh-acc-prod', `${t().product[r.product] || r.product} · ${r.display_name}`),
        el('span', `nh-acc-badge is-${r.status}`, t().status[r.status] || r.status));
      const bits = [date(r.created_at)];
      if (r.reference) bits.push(`${t().ref} ${r.reference}`);
      if (r.has_slip) bits.push(t().slip);
      row.append(head, el('p', 'nh-acc-meta', bits.join(' · ')));
      if (r.admin_note) row.append(el('p', 'nh-acc-note', r.admin_note));
      list.append(row);
    }
  }

  function render() {
    $('acc-loading').hidden = true;
    $('acc-out').hidden = !!state.user;
    $('acc-in').hidden = !state.user;
    showAlert(state.error);
    if (!state.user) return;
    $('acc-name').textContent = state.user.name;
    $('acc-email').textContent = state.user.email;
    $('acc-avatar').textContent = (state.user.name || state.user.email).trim().charAt(0).toUpperCase();
    $('acc-admin').hidden = !state.admin;
    renderLicenses();
    renderRequests();
    renderNanoShare();
  }

  function renderNanoShare() {
    const supporter = !!state.nanoshare?.supporter;
    $('ns-status').textContent = supporter ? t().nsSupporter : t().nsFree;
    $('ns-status').className = 'nh-acc-msg' + (supporter ? ' is-ok' : '');
    $('ns-support').hidden = supporter;
  }

  async function load() {
    try {
      const me = await api('/api/me');
      state.user = me.user;
      state.admin = me.admin;
      const [lic, req, ns] = await Promise.all([api('/api/licenses'), api('/api/requests'), api('/api/nanoshare').catch(() => null)]);
      state.nanoshare = ns;
      state.licenses = lic.licenses;
      state.maxMachines = lic.max_machines;
      state.requests = req.requests;
      for (const id of ['acc-f-name', 'acc-buy-name']) { const f = $(id); if (!f.value) f.value = state.user.name; }
    } catch (e) {
      state.user = null;
      if (e.status !== 401) state.error = 'load';
    }
    render();
  }

  $('acc-logout').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* signed out anyway */ }
    state.user = null;
    state.error = null;
    render();
  });

  $('acc-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $('acc-form-msg');
    const data = new FormData(form);
    const slip = data.get('slip');
    msg.className = 'nh-acc-msg';
    const bad = code => { msg.textContent = t().errors[code] || t().errors.other; msg.classList.add('is-bad'); };
    if (!String(data.get('name') || '').trim()) return bad('name');
    if (!String(data.get('reference') || '').trim() && !(slip && slip.size)) return bad('proof');
    if (slip && slip.size > 2 * 1024 * 1024) return bad('slip_size');
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    msg.textContent = t().sending;
    try {
      await api('/api/requests', { method: 'POST', body: data });
      form.reset();
      $('acc-f-name').value = state.user.name;
      msg.textContent = t().sent;
      msg.classList.add('is-ok');
      state.requests = (await api('/api/requests')).requests;
      renderRequests();
    } catch (err) {
      bad(err.code);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelectorAll('.nh-buy-opt').forEach(b => b.addEventListener('click', async () => {
    const msg = $('acc-buy-msg');
    msg.className = 'nh-acc-msg';
    msg.textContent = t().toStripe;
    document.querySelectorAll('.nh-buy-opt').forEach(x => { x.disabled = true; });
    try {
      const { url } = await api('/api/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product: b.dataset.product, term: b.dataset.term, name: $('acc-buy-name').value, lang: document.documentElement.lang }),
      });
      location.href = url;
    } catch (err) {
      msg.textContent = t().errors[err.code] || t().errors.other;
      msg.classList.add('is-bad');
      document.querySelectorAll('.nh-buy-opt').forEach(x => { x.disabled = false; });
    }
  }));

  // NanoShare supporter: 99 THB once, same Stripe Checkout as the License Keys
  $('ns-support').addEventListener('click', async () => {
    const b = $('ns-support');
    const msg = $('ns-status');
    b.disabled = true;
    msg.className = 'nh-acc-msg';
    msg.textContent = t().toStripe;
    try {
      const { url } = await api('/api/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product: 'nanoshare', term: 'supporter', lang: document.documentElement.lang }),
      });
      location.href = url;
    } catch (err) {
      msg.textContent = t().errors[err.code] || t().errors.other;
      msg.classList.add('is-bad');
      b.disabled = false;
    }
  });
  // back from Stripe Checkout: confirm the payment so the key is issued even before the webhook arrives
  async function afterCheckout(sessionId) {
    const msg = $('acc-buy-msg');
    try {
      const r = await api(`/api/checkout/${encodeURIComponent(sessionId)}/confirm`, { method: 'POST' });
      state.nanoshare = await api('/api/nanoshare').catch(() => state.nanoshare);
      // pick the message by what this checkout bought, not by the account's NanoShare status
      const nanoshare = r.paid && r.product === 'nanoshare';
      msg.textContent = nanoshare ? t().nsPaid : r.paid ? (r.issued ? t().paidOk : t().paidWait) : t().payNotDone;
      renderNanoShare();
      msg.classList.add(r.paid ? 'is-ok' : 'is-bad');
      state.licenses = (await api('/api/licenses')).licenses;
      renderLicenses();
    } catch (err) {
      msg.textContent = t().errors[err.code] || t().errors.other;
      msg.classList.add('is-bad');
    }
    $('buy').scrollIntoView({ block: 'center' });
  }

  document.addEventListener('nh:lang', () => { if (!$('acc-loading').hidden) return; render(); });

  const params = new URLSearchParams(location.search);
  if (params.has('error')) {
    state.error = params.get('error');
    params.delete('error');
    history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : '') + location.hash);
  }
  const paid = params.get('paid');
  const cancelled = params.has('cancelled');
  if (paid || cancelled) history.replaceState(null, '', location.pathname);
  load().then(() => {
    if (!state.user) return;
    if (paid) afterCheckout(paid);
    else if (params.get('support') === 'nanoshare') $('nanoshare').scrollIntoView({ block: 'center' });
    else if (cancelled) { $('acc-buy-msg').textContent = t().payCancelled; $('buy').scrollIntoView({ block: 'center' }); }
  });
})();
