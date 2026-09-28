// Admin tools: review support requests, issue, import and revoke License Keys.
import { MAX_MACHINES, machinesFor } from './activation.js';
import { PRODUCTS, expiryFor, readKey, signKey } from './license.js';
import { fail, isEmail, json, nowIso, readJson, str } from './util.js';

const TERMS = new Set(['1y', 'never']);

async function insertLicense(env, lic, admin, extra = {}) {
  const res = await env.DB.prepare(`INSERT INTO licenses (product, email, name, exp, plan, license_key, status, note, request_id, created_at, created_by)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?8, ?9, ?10)`)
    .bind(lic.product, lic.email.toLowerCase(), lic.name, lic.exp, lic.plan, lic.key, extra.note || '', extra.requestId || null, nowIso(), admin.email).run();
  return res.meta.last_row_id;
}

async function issue(env, admin, { product, email, name, term }, extra) {
  const exp = expiryFor(term);
  const key = await signKey(env.LICENSE_PRIVATE_JWK, product, name, email, exp);
  const id = await insertLicense(env, { product, email, name, exp, plan: 'pro', key }, admin, extra);
  return { id, key, exp };
}

export async function listRequests(env, url) {
  const all = url.searchParams.get('status') === 'all';
  const { results } = await env.DB.prepare(`SELECT id, email, product, display_name, reference, note, status, admin_note, created_at, decided_at,
    slip_type IS NOT NULL AS has_slip FROM requests ${all ? '' : "WHERE status = 'pending'"} ORDER BY created_at ${all ? 'DESC' : 'ASC'} LIMIT 200`).all();
  return json({ requests: results });
}

export async function slip(env, id) {
  const { value, metadata } = await env.SLIPS.getWithMetadata(`slip:${id}`, { type: 'arrayBuffer' });
  if (!value) return fail(404, 'not_found');
  return new Response(value, {
    headers: {
      'content-type': metadata?.type || 'application/octet-stream',
      'content-disposition': 'inline',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}

export async function approve(req, env, admin, id) {
  const body = await readJson(req);
  const term = TERMS.has(body.term) ? body.term : '1y';
  const r = await env.DB.prepare("SELECT * FROM requests WHERE id = ?1 AND status = 'pending'").bind(id).first();
  if (!r) return fail(404, 'not_found');
  const lic = await issue(env, admin, { product: r.product, email: r.email, name: r.display_name, term }, { requestId: r.id });
  await env.DB.prepare("UPDATE requests SET status = 'approved', license_id = ?2, admin_note = ?3, decided_at = ?4 WHERE id = ?1")
    .bind(id, lic.id, str(body.note, 500), nowIso()).run();
  return json({ ok: true, license: lic });
}

export async function reject(req, env, id) {
  const body = await readJson(req);
  const res = await env.DB.prepare("UPDATE requests SET status = 'rejected', admin_note = ?2, decided_at = ?3 WHERE id = ?1 AND status = 'pending'")
    .bind(id, str(body.note, 500), nowIso()).run();
  if (!res.meta.changes) return fail(404, 'not_found');
  return json({ ok: true });
}

export async function listLicenses(env, url) {
  const q = str(url.searchParams.get('q'), 120).toLowerCase();
  const { results } = await env.DB.prepare(`SELECT id, product, email, name, exp, plan, license_key, status, note, created_at, created_by
    FROM licenses WHERE status != 'deleted' AND (?1 = '' OR email LIKE ?2 OR lower(name) LIKE ?2) ORDER BY created_at DESC LIMIT 200`).bind(q, `%${q}%`).all();
  const machines = await machinesFor(env, results.map(l => l.id));
  return json({ licenses: results.map(l => ({ ...l, machines: machines[l.id] || [] })), max_machines: MAX_MACHINES });
}

export async function create(req, env, admin) {
  const body = await readJson(req);
  const product = str(body.product, 20);
  const email = str(body.email, 200).toLowerCase();
  const name = str(body.name, 80);
  if (!PRODUCTS[product]) return fail(400, 'product');
  if (!isEmail(email)) return fail(400, 'email');
  if (!name) return fail(400, 'name');
  const lic = await issue(env, admin, { product, email, name, term: TERMS.has(body.term) ? body.term : '1y' }, { note: str(body.note, 500) });
  return json({ ok: true, license: lic }, 201);
}

/** Adds keys made earlier with the PowerShell tools. Each key must carry a valid signature. */
export async function importKeys(req, env, admin) {
  const body = await readJson(req);
  const keys = String(body.keys || '').split(/\s+/).filter(Boolean).slice(0, 500);
  const out = { added: 0, duplicate: 0, invalid: 0 };
  for (const text of keys) {
    const lic = await readKey(text);
    if (!lic || !isEmail(lic.email)) { out.invalid++; continue; }
    const exists = await env.DB.prepare('SELECT 1 FROM licenses WHERE license_key = ?1').bind(lic.key).first();
    if (exists) { out.duplicate++; continue; }
    await insertLicense(env, lic, admin, { note: 'imported' });
    out.added++;
  }
  return json(out);
}

/** Deletes a key for good: hidden everywhere, its PCs freed, and apps that use it stop at their next check. */
export async function removeLicense(env, id) {
  // The row stays as a tombstone: a deleted key is still validly signed, and without its row /api/activate would
  // register it again as a new active key.
  const res = await env.DB.prepare("UPDATE licenses SET status = 'deleted' WHERE id = ?1 AND status != 'deleted'").bind(id).run();
  if (!res.meta.changes) return fail(404, 'not_found');
  await env.DB.prepare('DELETE FROM activations WHERE license_id = ?1').bind(id).run();
  return json({ ok: true });
}

/** Removes a decided request and its slip. Pending requests must be approved or rejected first. */
export async function removeRequest(env, id) {
  const res = await env.DB.prepare("DELETE FROM requests WHERE id = ?1 AND status != 'pending'").bind(id).run();
  if (!res.meta.changes) return fail(404, 'not_found');
  await env.SLIPS.delete(`slip:${id}`);
  return json({ ok: true });
}

export async function revoke(env, id) {
  const res = await env.DB.prepare("UPDATE licenses SET status = 'revoked' WHERE id = ?1 AND status = 'active'").bind(id).run();
  if (!res.meta.changes) return fail(404, 'not_found');
  return json({ ok: true });
}
