// Ties License Keys to machines (up to MAX_MACHINES each). The apps call /api/activate and keep the
// signed token; see docs/superpowers/specs/2026-09-28-machine-activation-design.md.
import { PRODUCTS, PUBLIC_JWK, readKey } from './license.js';
import { b64url, fail, json, nowIso, readJson, str } from './util.js';

export const MAX_MACHINES = 2;
const TOKEN_DAYS = 30;
const CHECK_DAYS = 7;
const ALG = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
const RATE = { perIp: 30, perKey: 20, window: 3600 };

export async function keyHash(key) {
  const bytes = new TextEncoder().encode(String(key).replace(/\s/g, ''));
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

function parseJwk(secret) {
  if (typeof secret !== 'string') return secret;
  const s = secret.trim();
  return JSON.parse(s.startsWith('{') ? s : atob(s));
}

/** NHA1-<b64url(payload)>.<b64url(sig)>, payload NHA1|product|keyHash|machine|issuedAt|validUntil */
export async function signToken(privateJwk, { product, keyHash: kh, machine, issuedAt, validUntil }) {
  const key = await crypto.subtle.importKey('jwk', { ...parseJwk(privateJwk), alg: 'RS256', ext: true }, ALG, false, ['sign']);
  const payload = new TextEncoder().encode(['NHA1', product, kh, machine, issuedAt, validUntil].join('|'));
  const sig = new Uint8Array(await crypto.subtle.sign(ALG.name, key, payload));
  return `NHA1-${b64url(payload)}.${b64url(sig)}`;
}

/** Fixed-window counter in D1. Returns false once `limit` requests were made in the window. */
async function allow(env, k, limit) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`INSERT INTO rate_limits (k, n, reset_at) VALUES (?1, 1, ?2)
    ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset_at < ?3 THEN 1 ELSE n + 1 END,
      reset_at = CASE WHEN reset_at < ?3 THEN ?2 ELSE reset_at END
    RETURNING n`).bind(k, now + RATE.window, now).first();
  // a window just started for this caller: drop counters whose window ended, so the table does not grow forever
  if (row.n === 1) await env.DB.prepare('DELETE FROM rate_limits WHERE reset_at < ?1').bind(now).run();
  return row.n <= limit;
}

const activeMachines = (env, licenseId) => env.DB.prepare(`SELECT id, machine, machine_name, created_at, last_seen FROM activations
  WHERE license_id = ?1 AND status = 'active' ORDER BY created_at`).bind(licenseId).all().then(r => r.results);

export async function activate(req, env, publicJwk = PUBLIC_JWK) {
  if (!env.ACTIVATION_PRIVATE_JWK) return fail(503, 'activation_off');
  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  if (!(await allow(env, `ip:${ip}`, RATE.perIp))) return fail(429, 'rate');

  const body = await readJson(req);
  const machine = str(body.machine, 64).toLowerCase();
  const name = str(body.name, 64).replace(/[\u0000-\u001f]/g, '') || 'PC';
  const app = str(body.app, 20);
  const version = str(body.version, 32);
  const mode = ['refresh', 'release'].includes(body.mode) ? body.mode : 'activate';
  if (!/^[0-9a-f]{64}$/.test(machine) || !PRODUCTS[app] || !body.key) return fail(400, 'bad_request');

  const lic = await readKey(body.key, publicJwk);
  if (!lic) return fail(400, 'invalid_key');
  if (lic.product !== app) return fail(400, 'wrong_product');
  const kh = await keyHash(lic.key);
  if (!(await allow(env, `key:${kh}`, RATE.perKey))) return fail(429, 'rate');
  const now = nowIso();

  if (mode === 'release') {
    // the app removed the key: free this machine's slot (needs both the key and this machine's id)
    await env.DB.prepare(`UPDATE activations SET status = 'removed', removed_at = ?3 WHERE status = 'active' AND machine = ?2
      AND license_id IN (SELECT id FROM licenses WHERE license_key = ?1)`).bind(lic.key, machine, now).run();
    return json({ ok: true, released: true });
  }
  if (lic.exp !== 'never' && lic.exp < now.slice(0, 10)) return fail(403, 'expired');

  let row = await env.DB.prepare('SELECT id, status FROM licenses WHERE license_key = ?1').bind(lic.key).first();
  if (!row) {
    // a validly signed key we have no record of (issued with the PowerShell tools): register it. Keys the admin
    // deleted keep their row with status 'deleted', so they land in the revoked branch below instead.
    const res = await env.DB.prepare(`INSERT INTO licenses (product, email, name, exp, plan, license_key, status, note, created_at, created_by)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', 'registered on activation', ?7, 'activation')`)
      .bind(lic.product, lic.email.toLowerCase(), lic.name, lic.exp, lic.plan, lic.key, now).run();
    row = { id: res.meta.last_row_id, status: 'active' };
  }
  if (row.status !== 'active') return fail(403, 'revoked'); // revoked, or deleted by the admin

  const seen = await env.DB.prepare(`UPDATE activations SET last_seen = ?3, machine_name = ?4, app_version = ?5
    WHERE license_id = ?1 AND machine = ?2 AND status = 'active'`).bind(row.id, machine, now, name, version).run();
  if (!seen.meta.changes) {
    // a machine the customer removed must be activated again by entering the key, not by a background refresh
    if (mode === 'refresh') return fail(410, 'deactivated');
    // One statement, so the count and the insert cannot be split by another request: two PCs activating at the
    // same moment must not both see a free slot. A removed row for this PC is brought back instead of inserted.
    const added = await env.DB.prepare(`INSERT INTO activations (license_id, machine, machine_name, app_version, status, created_at, last_seen)
      SELECT ?1, ?2, ?3, ?4, 'active', ?5, ?5
      WHERE (SELECT COUNT(*) FROM activations WHERE license_id = ?1 AND status = 'active' AND machine != ?2) < ?6
      ON CONFLICT (license_id, machine) DO UPDATE SET status = 'active', machine_name = excluded.machine_name,
        app_version = excluded.app_version, last_seen = excluded.last_seen, removed_at = NULL,
        created_at = CASE WHEN activations.status = 'active' THEN activations.created_at ELSE excluded.created_at END`)
      .bind(row.id, machine, name, version, now, MAX_MACHINES).run();
    if (!added.meta.changes) {
      const machines = await activeMachines(env, row.id);
      return json({ error: 'limit', max: MAX_MACHINES, machines: machines.map(m => ({ name: m.machine_name, last_seen: m.last_seen })) }, 409);
    }
  }

  const validUntil = new Date(Date.now() + TOKEN_DAYS * 86400e3).toISOString();
  const token = await signToken(env.ACTIVATION_PRIVATE_JWK, { product: lic.product, keyHash: kh, machine, issuedAt: now, validUntil });
  return json({ ok: true, token, valid_until: validUntil, check_days: CHECK_DAYS });
}

/** Machines per license id, for the account and admin lists. */
export async function machinesFor(env, licenseIds) {
  if (!licenseIds.length) return {};
  const marks = licenseIds.map((_, i) => `?${i + 1}`).join(',');
  const { results } = await env.DB.prepare(`SELECT id, license_id, machine_name, app_version, created_at, last_seen FROM activations
    WHERE status = 'active' AND license_id IN (${marks}) ORDER BY created_at`).bind(...licenseIds).all();
  const out = {};
  for (const m of results) (out[m.license_id] ||= []).push({ id: m.id, name: m.machine_name, version: m.app_version, created_at: m.created_at, last_seen: m.last_seen });
  return out;
}

async function removeActivation(env, id, ownerEmail) {
  const sql = ownerEmail
    ? `UPDATE activations SET status = 'removed', removed_at = ?2 WHERE id = ?1 AND status = 'active'
       AND license_id IN (SELECT id FROM licenses WHERE email = ?3)`
    : "UPDATE activations SET status = 'removed', removed_at = ?2 WHERE id = ?1 AND status = 'active'";
  const stmt = env.DB.prepare(sql);
  const res = await (ownerEmail ? stmt.bind(id, nowIso(), ownerEmail) : stmt.bind(id, nowIso())).run();
  if (!res.meta.changes) return fail(404, 'not_found');
  return json({ ok: true });
}

export const removeOwnMachine = (env, user, id) => removeActivation(env, id, user.email);
export const removeMachineAsAdmin = (env, id) => removeActivation(env, id, null);
