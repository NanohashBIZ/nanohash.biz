// NanoShare passes: a signed statement of what a NanoHash account may send on share.nanohash.biz.
//   free (no pass) 200 MB per send · account (signed in) 1 GB · supporter (99 THB once) unlimited
// Pass = b64url(JSON payload) + "." + b64url(ECDSA P-256 / SHA-256 signature, raw r||s).
// share.nanohash.biz holds the public key and checks it; nothing else about the user leaves here.
import { currentUser } from './auth.js';
import { b64url, cookie, fail, json, readCookies, redirect } from './util.js';

const ACCOUNT_DAYS = 7;
const SUPPORTER_DAYS = 100 * 365;   // supporting is for good: the pass doesn't run out
export const SUPPORTER_PRICE = 9900; // satang: 99 THB
const utf8 = new TextEncoder();

/** The page NanoShare sends people to: signs them in if needed, then hands the pass back. */
export const PASS_PATH = '/api/nanoshare/pass';
const PICK_COOKIE = 'nh_nspick';
export const isPassNext =next => /^\/api\/nanoshare\/pass\?[A-Za-z0-9=&_.-]{0,200}$/.test(next || '');

async function signingKey(env) {
  if (!env.NANOSHARE_PASS_JWK) throw Object.assign(new Error('NANOSHARE_PASS_JWK missing'), { status: 503 });
  const jwk = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(env.NANOSHARE_PASS_JWK), c => c.charCodeAt(0))));
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

export async function signPass(env, payload) {
  const body = b64url(utf8.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(env), utf8.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function isSupporter(env, userId) {
  const row = await env.DB.prepare('SELECT nanoshare_supporter FROM users WHERE id = ?1').bind(userId).first();
  return row?.nanoshare_supporter === 1;
}

async function passFor(env, user) {
  const supporter = await isSupporter(env, user.id);
  const days = supporter ? SUPPORTER_DAYS : ACCOUNT_DAYS;
  return signPass(env, {
    v: 1, sub: user.id, name: user.name, tier: supporter ? 'supporter' : 'account',
    exp: Math.floor(Date.now() / 1000) + days * 86400,
  });
}

/**
 * GET /api/nanoshare/pass?to=web            → https://share.nanohash.biz/#pass=<pass>
 * GET /api/nanoshare/pass?to=app&port=&state= → http://127.0.0.1:<port>/nanoshare-pass?state=&pass=  (the Windows app listens there)
 * Not signed in: goes through Google sign-in first and comes back here.
 */
export async function passPage(req, env, url, site) {
  const to = url.searchParams.get('to');
  const port = Number(url.searchParams.get('port'));
  const state = url.searchParams.get('state') || '';
  const share = env.NANOSHARE_ORIGIN || 'https://share.nanohash.biz';
  if (to !== 'web' && !(to === 'app' && Number.isInteger(port) && port >= 1024 && port <= 65535 && /^[A-Za-z0-9_-]{16,64}$/.test(state))) {
    return fail(400, 'bad_request');
  }
  // Always through Google's account chooser first (even when already signed in here), so people pick
  // which Google account NanoShare uses. "picked" marks the trip back from Google; it must match a
  // one-time value in a cookie we set just now, so a crafted link can't skip the chooser.
  const user = await currentUser(req, env);
  const picked = url.searchParams.get('picked');
  const expected = readCookies(req)[PICK_COOKIE];
  if (!user || !picked || !expected || picked !== expected) {
    const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const back = new URL(url);
    back.searchParams.set('picked', nonce);
    return redirect(`/api/auth/google?next=${encodeURIComponent(back.pathname + back.search)}`,
      [['set-cookie', cookie(PICK_COOKIE, nonce, { maxAge: 600, path: PASS_PATH, secure: (site ?? url).protocol === 'https:' })]]);
  }
  const used = ['set-cookie', cookie(PICK_COOKIE, '', { maxAge: 0, path: PASS_PATH, secure: (site ?? url).protocol === 'https:' })];
  const pass = await passFor(env, user);
  return to === 'web'
    ? redirect(`${share}/#pass=${pass}`, [used])
    : redirect(`http://127.0.0.1:${port}/nanoshare-pass?state=${encodeURIComponent(state)}&pass=${encodeURIComponent(pass)}`, [used]);
}

/** /account: this user's NanoShare level. */
export async function status(user, env) {
  return json({ supporter: await isSupporter(env, user.id), price: SUPPORTER_PRICE });
}

/** Admin: every NanoShare supporter, with the Stripe payment when there is one (none = set by an admin). */
export async function listSupporters(env) {
  const { results } = await env.DB.prepare(`SELECT u.id, u.email, u.name, u.created_at, u.last_login,
      o.amount, o.currency, o.paid_at, o.livemode
    FROM users u
    LEFT JOIN orders o ON o.session_id = (
      SELECT session_id FROM orders WHERE user_id = u.id AND product = 'nanoshare' AND status = 'paid' ORDER BY paid_at DESC LIMIT 1)
    WHERE u.nanoshare_supporter = 1
    ORDER BY COALESCE(o.paid_at, u.created_at) DESC`).all();
  return json({ supporters: results });
}

/** Admin: grant or take back supporter status by email. */
export async function setSupporter(req, env) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const res = await env.DB.prepare('UPDATE users SET nanoshare_supporter = ?2 WHERE email = ?1').bind(email, body.supporter ? 1 : 0).run();
  return res.meta.changes ? json({ ok: true }) : fail(404, 'no_user');
}
