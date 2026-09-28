// Sign in with Google (OAuth 2.0 authorization code flow with PKCE) and cookie sessions.
import { cookie, fail, fromB64url, json, nowIso, randomToken, readCookies, redirect, sha256, b64url } from './util.js';
import { isPassNext } from './nanoshare.js';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const SESSION_DAYS = 30;
const NEXT = new Set(['/account', '/admin']);
const SESSION = 'nh_session';
const OAUTH = 'nh_oauth';

// `site` is the public origin (SITE_ORIGIN): Google only accepts the callback URL registered for it.
const secure = site => site.protocol === 'https:';
const callbackUrl = site => `${site.origin}/api/auth/callback`;

/** Where sign-in may return to: a known page or NanoShare's pass page, never another site. */
const safeNext = next => (NEXT.has(next) || isPassNext(next) ? next : '/account');

export function isAdmin(env, email) {
  return String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean).includes(email);
}

export async function start(req, env, url, site) {
  // www: start again on the main origin so the cookies land on one host
  if (url.hostname.startsWith('www.')) return redirect(`${site.origin}${url.pathname}${url.search}`);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirect('/account?error=setup');
  const asked = url.searchParams.get('next');
  // NanoShare's pass page may ask to come back to it (with its own query)
  const next = safeNext(asked);
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(site),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return redirect(`${GOOGLE_AUTH}?${q}`, [
    ['set-cookie', cookie(OAUTH, `${state} ${verifier} ${next}`, { maxAge: 600, path: '/api/auth', secure: secure(site) })],
  ]);
}

export async function callback(req, env, url, site) {
  const [state, verifier, next] = (readCookies(req)[OAUTH] || '').split(' ');
  const clear = ['set-cookie', cookie(OAUTH, '', { maxAge: 0, path: '/api/auth', secure: secure(site) })];
  const back = code => redirect(`${next === '/admin' ? '/admin' : '/account'}?error=${code}`, [clear]);
  if (url.searchParams.get('error')) return back('cancelled');
  if (!state || url.searchParams.get('state') !== state || !url.searchParams.get('code')) return back('state');

  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: url.searchParams.get('code'),
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(site),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (!res.ok) return back('google');
  const { id_token: idToken } = await res.json();
  // The ID token comes straight from Google's token endpoint over TLS, so its claims can be trusted
  // after checking audience, issuer and expiry (OpenID Connect Core 3.1.3.7).
  let claims;
  try { claims = JSON.parse(new TextDecoder().decode(fromB64url(idToken.split('.')[1]))); } catch { return back('google'); }
  if (claims.aud !== env.GOOGLE_CLIENT_ID || !['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)
    || claims.exp * 1000 < Date.now() || !claims.sub) return back('google');
  if (!claims.email || claims.email_verified !== true) return back('email');

  const email = String(claims.email).toLowerCase();
  const now = nowIso();
  await env.DB.prepare(`INSERT INTO users (id, email, name, created_at, last_login) VALUES (?1, ?2, ?3, ?4, ?4)
    ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, last_login = excluded.last_login`)
    .bind(claims.sub, email, String(claims.name || email).slice(0, 120), now).run();

  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400e3).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(now),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(await sha256(token), claims.sub, now, expires),
  ]);
  // checked again: the cookie came back from the browser, and a planted one must not become an open redirect
  return redirect(safeNext(next), [clear, ['set-cookie', cookie(SESSION, token, { maxAge: SESSION_DAYS * 86400, secure: secure(site) })]]);
}

export async function currentUser(req, env) {
  const token = readCookies(req)[SESSION];
  if (!token) return null;
  const row = await env.DB.prepare(`SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?1 AND s.expires_at > ?2`).bind(await sha256(token), nowIso()).first();
  if (!row) return null;
  return { ...row, admin: isAdmin(env, row.email) };
}

export async function logout(req, env, site) {
  const token = readCookies(req)[SESSION];
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256(token)).run();
  return json({ ok: true }, 200, [['set-cookie', cookie(SESSION, '', { maxAge: 0, secure: secure(site) })]]);
}

export const needUser = user => (user ? null : fail(401, 'signed_out'));
