// Admin page: review support requests, issue, import, revoke and delete License Keys. Thai only.
(() => {
  const PRODUCT = { tidyup: 'TidyUp PC', nanopdf: 'NanoPDF' };
  const STATUS = { pending: 'รอตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', active: 'ใช้งาน', revoked: 'ยกเลิกแล้ว' };
  const ERR = {
    product: 'เลือกโปรแกรม', email: 'อีเมลไม่ถูกต้อง', name: 'ใส่ชื่อ', not_found: 'ไม่พบรายการนี้ (อาจถูกจัดการไปแล้ว)',
    signed_out: 'หมดเวลาการเข้าสู่ระบบ', not_admin: 'บัญชีนี้ไม่ใช่ผู้ดูแล', origin: 'คำขอไม่ถูกต้อง',
    cancelled: 'ยกเลิกการเข้าสู่ระบบแล้ว', state: 'การเข้าสู่ระบบหมดเวลา ลองใหม่', google: 'เข้าสู่ระบบกับ Google ไม่สำเร็จ',
    email_unverified: 'อีเมลยังไม่ยืนยัน', setup: 'ยังไม่ได้ตั้งค่า Google Sign-in', server: 'เซิร์ฟเวอร์ผิดพลาด',
  };
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const when = iso => new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const expText = exp => (exp === 'never' ? 'ตลอดชีพ' : `ถึง ${exp}`);

  async function api(path, opts = {}) {
    const init = { credentials: 'same-origin', ...opts };
    if (opts.json) { init.method = 'POST'; init.headers = { 'content-type': 'application/json' }; init.body = JSON.stringify(opts.json); }
    const res = await fetch(path, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error || 'server'), { status: res.status, code: body.error || 'server' });
    return body;
  }

  function alertBox(msg) {
    $('ad-alert').hidden = !msg;
    $('ad-alert').textContent = msg || '';
  }
  const errText = e => ERR[e.code] || `ผิดพลาด (${e.code})`;

  function button(text, cls, onClick) {
    const b = el('button', `nh-btn nh-btn--small ${cls}`, text);
    b.type = 'button';
    b.addEventListener('click', async () => {
      b.disabled = true;
      try { await onClick(); } catch (e) { alertBox(errText(e)); } finally { b.disabled = false; }
    });
    return b;
  }

  function requestCard(r, withActions) {
    const card = el('article', 'nh-acc-item');
    const head = el('div', 'nh-acc-item-head');
    head.append(el('strong', 'nh-acc-prod', `${PRODUCT[r.product] || r.product} · ${r.display_name}`), el('span', `nh-acc-badge is-${r.status}`, STATUS[r.status]));
    card.append(head, el('p', 'nh-acc-meta', `${r.email} · ส่งเมื่อ ${when(r.created_at)}`));
    if (r.reference) card.append(el('p', 'nh-acc-note', `เลขอ้างอิง: ${r.reference}`));
    if (r.note) card.append(el('p', 'nh-acc-note', `ข้อความ: ${r.note}`));
    if (r.admin_note) card.append(el('p', 'nh-acc-note', `บันทึกผู้ดูแล: ${r.admin_note}`));
    const actions = el('div', 'nh-acc-actions');
    if (r.has_slip) {
      const a = el('a', 'nh-btn nh-btn--secondary nh-btn--small', 'ดูสลิป');
      a.href = `/api/admin/requests/${r.id}/slip`;
      a.target = '_blank';
      a.rel = 'noopener';
      actions.append(a);
    }
    if (withActions) {
      const approve = term => async () => {
        if (!confirm(`อนุมัติและออก Key ${term === 'never' ? 'ตลอดชีพ' : '1 ปี'} ให้ ${r.email}?`)) return;
        await api(`/api/admin/requests/${r.id}/approve`, { json: { term } });
        alertBox(null);
        await loadPending();
      };
      actions.append(
        button('อนุมัติ 1 ปี', 'nh-btn--primary', approve('1y')),
        button('อนุมัติตลอดชีพ', 'nh-btn--primary', approve('never')),
        button('ไม่อนุมัติ', 'nh-btn--secondary', async () => {
          const note = prompt('เหตุผลที่ไม่อนุมัติ (ผู้ใช้จะเห็นข้อความนี้)', 'ตรวจไม่พบรายการสนับสนุน กรุณาติดต่อ support@nanohash.biz');
          if (note === null) return;
          await api(`/api/admin/requests/${r.id}/reject`, { json: { note } });
          await loadPending();
        }),
      );
    }
    if (!withActions && r.status !== 'pending') {
      actions.append(button('ลบ', 'nh-btn--danger', async () => {
        if (!confirm(`ลบคำขอของ ${r.email} ออกจากรายการ? (สลิปที่แนบจะถูกลบด้วย ส่วน License Key ที่ออกไปแล้วไม่ถูกลบ)`)) return;
        await api(`/api/admin/requests/${r.id}/delete`, { method: 'POST' });
        await loadHistory();
      }));
    }
    if (actions.childNodes.length) card.append(actions);
    return card;
  }

  function fill(list, items, make, empty) {
    list.replaceChildren(...(items.length ? items.map(make) : [el('p', 'nh-acc-empty', empty)]));
  }

  async function loadPending() {
    const { requests } = await api('/api/admin/requests');
    $('ad-count').textContent = requests.length ? `(${requests.length})` : '';
    fill($('ad-pending'), requests, r => requestCard(r, true), 'ไม่มีคำขอรอตรวจ');
  }

  async function loadHistory() {
    const { requests } = await api('/api/admin/requests?status=all');
    fill($('ad-history'), requests, r => requestCard(r, false), 'ยังไม่มีคำขอ');
  }

  async function loadKeys(q = '') {
    const { licenses } = await api(`/api/admin/licenses?q=${encodeURIComponent(q)}`);
    fill($('ad-keys'), licenses, lic => {
      const card = el('article', 'nh-acc-item');
      const head = el('div', 'nh-acc-item-head');
      head.append(el('strong', 'nh-acc-prod', `${PRODUCT[lic.product]} · ${lic.name}`), el('span', `nh-acc-badge is-${lic.status}`, `${STATUS[lic.status]} · ${expText(lic.exp)}`));
      card.append(head, el('p', 'nh-acc-meta', `${lic.email} · ออกเมื่อ ${when(lic.created_at)} โดย ${lic.created_by}${lic.note ? ` · ${lic.note}` : ''}`));
      card.append(el('code', 'nh-acc-key', lic.license_key));
      const machines = el('div', 'nh-acc-machines');
      machines.append(el('p', 'nh-acc-machines-title', `เครื่องที่ใช้ ${(lic.machines || []).length}/2`));
      for (const m of lic.machines || []) {
        const row = el('div', 'nh-acc-machine');
        const who = el('div', 'nh-acc-machine-who');
        who.append(el('strong', null, m.name), el('small', null, `v${m.version || '?'} · เริ่มใช้ ${when(m.created_at)} · ล่าสุด ${when(m.last_seen)}`));
        row.append(who, button('เอาออก', 'nh-btn--secondary', async () => {
          if (!confirm(`เอา ${m.name} ออกจาก Key นี้?`)) return;
          await api(`/api/admin/machines/${m.id}/remove`, { method: 'POST' });
          await loadKeys($('ad-search').q.value);
        }));
        machines.append(row);
      }
      card.append(machines);
      const actions = el('div', 'nh-acc-actions');
      actions.append(button('คัดลอก', 'nh-btn--secondary', () => navigator.clipboard.writeText(lic.license_key)));
      if (lic.status === 'active') {
        actions.append(button('ยกเลิกในบัญชี', 'nh-btn--secondary', async () => {
          if (!confirm('ซ่อน Key นี้จากบัญชีผู้ใช้? (Key ที่ใส่ในโปรแกรมแล้วยังใช้ได้ เพราะตรวจแบบออฟไลน์)')) return;
          await api(`/api/admin/licenses/${lic.id}/revoke`, { method: 'POST' });
          await loadKeys($('ad-search').q.value);
        }));
      }
      actions.append(button('ลบ', 'nh-btn--danger', async () => {
        const warn = lic.status === 'active'
          ? `ลบ Key ${PRODUCT[lic.product]} ของ ${lic.email} ถาวร?\n\nKey นี้ยังใช้งานอยู่ ผู้ใช้จะไม่เห็นในบัญชีอีก แต่ถ้าใส่ในโปรแกรมไปแล้วจะยังใช้ได้ (ตรวจแบบออฟไลน์)`
          : `ลบ Key ${PRODUCT[lic.product]} ของ ${lic.email} ถาวร?`;
        if (!confirm(warn)) return;
        await api(`/api/admin/licenses/${lic.id}/delete`, { method: 'POST' });
        await loadKeys($('ad-search').q.value);
      }));
      card.append(actions);
      return card;
    }, 'ไม่พบ Key');
  }

  const loaders = { pending: loadPending, history: loadHistory, keys: () => loadKeys($('ad-search').q.value) };
  document.querySelectorAll('.nh-ad-tabs [data-tab]').forEach(tab => tab.addEventListener('click', async () => {
    document.querySelectorAll('.nh-ad-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b === tab)));
    document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    alertBox(null);
    try { await loaders[tab.dataset.tab]?.(); } catch (e) { alertBox(errText(e)); }
  }));

  $('ad-search').addEventListener('submit', e => { e.preventDefault(); loadKeys(e.currentTarget.q.value).catch(err => alertBox(errText(err))); });

  $('ad-issue').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget;
    const msg = $('ad-issue-msg');
    const data = Object.fromEntries(new FormData(f));
    msg.className = 'nh-acc-msg';
    try {
      const { license } = await api('/api/admin/licenses', { json: data });
      msg.textContent = `ออก Key แล้ว (${expText(license.exp)}) ขึ้นในบัญชี ${data.email} เรียบร้อย`;
      msg.classList.add('is-ok');
      f.reset();
    } catch (err) {
      msg.textContent = errText(err);
      msg.classList.add('is-bad');
    }
  });

  $('ad-import').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget;
    const msg = $('ad-import-msg');
    msg.className = 'nh-acc-msg';
    try {
      const r = await api('/api/admin/licenses/import', { json: { keys: f.keys.value } });
      msg.textContent = `เพิ่ม ${r.added} · ซ้ำ ${r.duplicate} · ไม่ถูกต้อง ${r.invalid}`;
      msg.classList.add(r.invalid ? 'is-bad' : 'is-ok');
      if (!r.invalid) f.reset();
    } catch (err) {
      msg.textContent = errText(err);
      msg.classList.add('is-bad');
    }
  });

  async function start() {
    const params = new URLSearchParams(location.search);
    if (params.has('error')) { alertBox(ERR[params.get('error')] || 'เข้าสู่ระบบไม่สำเร็จ'); history.replaceState(null, '', location.pathname); }
    try {
      const me = await api('/api/me');
      $('ad-loading').hidden = true;
      if (!me.admin) {
        $('ad-out').hidden = false;
        $('ad-out-text').textContent = `${me.user.email} ไม่ใช่บัญชีผู้ดูแล`;
        return;
      }
      $('ad-in').hidden = false;
      await loadPending();
    } catch (e) {
      $('ad-loading').hidden = true;
      $('ad-out').hidden = false;
      if (e.status !== 401) alertBox(errText(e));
    }
  }
  start();
})();
