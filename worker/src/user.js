// What a signed-in user can see and do: their License Keys and support requests.
import { MAX_MACHINES, machinesFor } from './activation.js';
import { PRODUCTS } from './license.js';
import { retryStuck } from './stripe.js';
import { fail, json, nowIso, str } from './util.js';

const SLIP_MAX = 2 * 1024 * 1024;
const SLIP_DAYS = 90;
const MAX_PENDING = 3;
const MAX_PER_DAY = 10;

export function me(user) {
  return json({ user: { email: user.email, name: user.name }, admin: user.admin });
}

export async function myLicenses(user, env) {
  await retryStuck(env, user.id);
  const { results } = await env.DB.prepare(`SELECT id, product, name, email, exp, plan, license_key, created_at FROM licenses
    WHERE email = ?1 AND status = 'active' ORDER BY created_at DESC`).bind(user.email).all();
  const machines = await machinesFor(env, results.map(l => l.id));
  return json({ licenses: results.map(l => ({ ...l, machines: machines[l.id] || [] })), max_machines: MAX_MACHINES });
}

export async function myRequests(user, env) {
  const { results } = await env.DB.prepare(`SELECT id, product, display_name, reference, status, admin_note, created_at, decided_at,
    slip_type IS NOT NULL AS has_slip FROM requests WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 50`).bind(user.id).all();
  return json({ requests: results });
}

/** Sniffs the file type from its first bytes instead of trusting the browser. */
export function slipType(bytes) {
  const b = bytes.subarray(0, 12);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'image/webp';
  if (String.fromCharCode(...b.subarray(0, 5)) === '%PDF-') return 'application/pdf';
  return null;
}

export async function createRequest(req, user, env) {
  let form;
  try { form = await req.formData(); } catch { return fail(400, 'bad_form'); }
  const product = str(form.get('product'), 20);
  const displayName = str(form.get('name'), 80);
  const reference = str(form.get('reference'), 200);
  const note = str(form.get('note'), 500);
  const file = form.get('slip');
  if (!PRODUCTS[product]) return fail(400, 'product');
  if (!displayName) return fail(400, 'name');

  let slip = null;
  let type = null;
  if (file && typeof file === 'object' && file.size > 0) {
    if (file.size > SLIP_MAX) return fail(400, 'slip_size');
    slip = new Uint8Array(await file.arrayBuffer());
    type = slipType(slip);
    if (!type) return fail(400, 'slip_type');
  }
  if (!reference && !slip) return fail(400, 'proof');

  const since = new Date(Date.now() - 86400e3).toISOString();
  const counts = await env.DB.prepare(`SELECT SUM(status = 'pending') AS pending, SUM(created_at > ?2) AS today
    FROM requests WHERE user_id = ?1`).bind(user.id, since).first();
  if ((counts?.pending || 0) >= MAX_PENDING) return fail(429, 'too_many_pending');
  if ((counts?.today || 0) >= MAX_PER_DAY) return fail(429, 'too_many');

  const res = await env.DB.prepare(`INSERT INTO requests (user_id, email, product, display_name, reference, note, slip_type, status, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8)`)
    .bind(user.id, user.email, product, displayName, reference, note, type, nowIso()).run();
  const id = res.meta.last_row_id;
  if (slip) await env.SLIPS.put(`slip:${id}`, slip, { expirationTtl: SLIP_DAYS * 86400, metadata: { type } });
  return json({ ok: true, id }, 201);
}
