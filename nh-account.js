// Account page: signs in with Google (server side), lists License Keys and support requests.
(() => {
  const T = {
    th: {
      product: { tidyup: 'TidyUp PC', nanopdf: 'NanoPDF' },
      never: 'ใช้ได้ตลอด', expires: 'ใช้ได้ถึง', expired: 'หมดอายุแล้ว', issued: 'ออกให้เมื่อ',
      copy: 'คัดลอก', copied: 'คัดลอกแล้ว',
      noLicenses: 'ยังไม่มี License Key ในบัญชีนี้ ถ้าสนับสนุนเราแล้ว แจ้งได้ในฟอร์มด้านล่าง',
      noRequests: 'ยังไม่มีคำขอ',
      status: { pending: 'รอตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ' },
      ref: 'อ้างอิง', slip: 'แนบสลิปแล้ว', sent: 'ส่งคำขอแล้ว เราจะตรวจสอบและแจ้งผลในหน้านี้', sending: 'กำลังส่ง…',
      errors: {
        cancelled: 'ยกเลิกการเข้าสู่ระบบแล้ว', state: 'การเข้าสู่ระบบหมดเวลา ลองใหม่อีกครั้ง',
        google: 'เข้าสู่ระบบกับ Google ไม่สำเร็จ ลองใหม่อีกครั้ง', email: 'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล',
        setup: 'ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน', load: 'โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้า',
        name: 'ใส่ชื่อที่จะแสดงใน License Key', proof: 'ใส่เลขอ้างอิงหรือแนบสลิปอย่างใดอย่างหนึ่ง',
        slip_size: 'ไฟล์สลิปใหญ่เกิน 2 MB', slip_type: 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF',
        too_many_pending: 'มีคำขอรอตรวจสอบอยู่แล้ว 3 รายการ รอผลก่อนนะ', too_many: 'ส่งคำขอบ่อยเกินไป ลองใหม่พรุ่งนี้',
        signed_out: 'หมดเวลาการเข้าสู่ระบบ เข้าสู่ระบบอีกครั้ง', other: 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง',
      },
    },
    en: {
      product: { tidyup: 'TidyUp PC', nanopdf: 'NanoPDF' },
      never: 'Lifetime', expires: 'Valid until', expired: 'Expired', issued: 'Issued',
      copy: 'Copy', copied: 'Copied',
      noLicenses: 'No License Keys in this account yet. If you have supported us, tell us in the form below.',
      noRequests: 'No requests yet',
      status: { pending: 'Being checked', approved: 'Approved', rejected: 'Not approved' },
      ref: 'Reference', slip: 'Slip attached', sent: 'Request sent. We will check it and show the result here.', sending: 'Sending…',
      errors: {
        cancelled: 'Sign-in was cancelled.', state: 'Sign-in timed out. Please try again.',
        google: 'Could not sign in with Google. Please try again.', email: 'This Google account has not verified its email.',
        setup: 'Sign-in is not available yet.', load: 'Could not load your data. Try refreshing the page.',
        name: 'Enter the name to show in the License Key.', proof: 'Enter a reference number or attach a slip.',
        slip_size: 'The slip file is larger than 2 MB.', slip_type: 'Only JPG, PNG, WebP or PDF files are accepted.',
        too_many_pending: 'You already have 3 requests being checked. Please wait for the result.', too_many: 'Too many requests. Please try again tomorrow.',
        signed_out: 'Your session has ended. Please sign in again.', other: 'Could not send. Please try again.',
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
    for (const lic of state.licenses) {
      const row = el('article', 'nh-acc-item nh-acc-lic');
      const head = el('div', 'nh-acc-item-head');
      const title = el('strong', 'nh-acc-prod');
      title.append(el('i', `nh-dl-dot nh-dl-dot--${lic.product === 'tidyup' ? 'tidy' : 'pdf'}`), t().product[lic.product] || lic.product);
      const expired = lic.exp !== 'never' && lic.exp < today();
      const exp = el('span', `nh-acc-badge${expired ? ' is-bad' : ' is-ok'}`,
        lic.exp === 'never' ? t().never : expired ? `${t().expired} ${date(lic.exp)}` : `${t().expires} ${date(lic.exp)}`);
      head.append(title, exp);
      const meta = el('p', 'nh-acc-meta', `${lic.name} · ${lic.email} · ${t().issued} ${date(lic.created_at)}`);
      const key = el('code', 'nh-acc-key', lic.license_key);
      const actions = el('div', 'nh-acc-actions');
      const copy = el('button', 'nh-btn nh-btn--primary nh-btn--small', t().copy);
      copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(lic.license_key); } catch { selectText(key); return; }
        copy.textContent = t().copied;
        setTimeout(() => { copy.textContent = t().copy; }, 1800);
      });
      actions.append(copy);
      row.append(head, meta, key, actions);
      list.append(row);
    }
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
  }

  async function load() {
    try {
      const me = await api('/api/me');
      state.user = me.user;
      state.admin = me.admin;
      const [lic, req] = await Promise.all([api('/api/licenses'), api('/api/requests')]);
      state.licenses = lic.licenses;
      state.requests = req.requests;
      const name = $('acc-f-name');
      if (!name.value) name.value = state.user.name;
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

  document.addEventListener('nh:lang', () => { if (!$('acc-loading').hidden) return; render(); });

  const params = new URLSearchParams(location.search);
  if (params.has('error')) {
    state.error = params.get('error');
    params.delete('error');
    history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : '') + location.hash);
  }
  load();
})();
