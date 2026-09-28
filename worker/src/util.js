// Small helpers shared by the API handlers.

export function json(data, status = 200, headers = []) {
  return new Response(JSON.stringify(data), {
    status,
    headers: [['content-type', 'application/json; charset=utf-8'], ['cache-control', 'no-store'], ...headers],
  });
}

export const fail = (status, code) => json({ error: code }, status);

export function redirect(location, headers = []) {
  return new Response(null, { status: 302, headers: [['location', location], ['cache-control', 'no-store'], ...headers] });
}

export function readCookies(req) {
  const out = {};
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const raw = part.slice(i + 1).trim();
    // a malformed %-escape (another site's cookie, a hand-edited one) must not turn every request into a 500
    try { out[part.slice(0, i).trim()] = decodeURIComponent(raw); } catch { out[part.slice(0, i).trim()] = raw; }
  }
  return out;
}

export function cookie(name, value, { maxAge, path = '/', secure = true }) {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

export async function sha256(text) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

export const nowIso = () => new Date().toISOString();

export async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

export const str = (v, max) => String(v ?? '').trim().slice(0, max);

export const isEmail = s => /^[^\s@|]+@[^\s@|]+\.[^\s@|]+$/.test(s);
