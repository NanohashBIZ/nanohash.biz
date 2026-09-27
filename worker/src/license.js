// Signs and reads the offline License Keys that TidyUp PC and NanoPDF check.
// Same format as TidyUpPC/dev/Make-LicenseKey.ps1 and NanoPDF/tools/Make-NanoPdfKey.ps1:
// <prefix><b64url(payload)>.<b64url(signature)>, RSA-2048 PKCS#1 v1.5 over SHA-256.
import { b64url, fromB64url } from './util.js';

export const PRODUCTS = {
  tidyup: { name: 'TidyUp PC', prefix: 'SC1-', payload: (n, e, x, p) => `${n}|${e}|${x}|${p}` },
  nanopdf: { name: 'NanoPDF', prefix: 'NP1-', payload: (n, e, x, p) => `NanoPDF|${n}|${e}|${x}|${p}` },
};

// Public half of TidyUpPC/dev/keys/public.xml. Both apps use this key pair.
export const PUBLIC_JWK = {
  kty: 'RSA',
  n: 'tmTY_JRwmtfWikCTlig4RR6CWviEMA0r9YrziYTPtaKE1YYLgxB7AN6D2m3ZtL2bFl_6Az5hNYHtYdXKZu4BUhMxe9IJmAR2OqC-ic32YT-ujuPJNYL5rG3_WlJrHXWzLhtAtKK1ivjBN4hNsyJoXxTCK2_0n5XN3hGo4_MUpuxprWKv5ZMOr9SAtqoKx58UoZnyCuYQF40jDv-yM4CDxuFS0cIb-35GWq5zHhCGAMfDEQteiKVos51_QRr-3TKgbAZb4VNVYl3HiiNbiEnW12QsF6mSbqMUCp9ZuBSdGkn_3s8Yqg87AdthD7rDnQog6xJRphbBvUM8dpzMMMsMeQ',
  e: 'AQAB',
};

const ALG = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
const clean = s => String(s).replace(/\|/g, '/').trim();

/** 'never' for lifetime, otherwise the date one year from today (yyyy-MM-dd), like the PowerShell tools. */
export function expiryFor(term, today = new Date()) {
  if (term === 'never') return 'never';
  const d = new Date(today);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export async function signKey(privateJwk, product, name, email, exp, plan = 'pro') {
  const p = PRODUCTS[product];
  if (!p) throw new Error('unknown product');
  const jwk = typeof privateJwk === 'string' ? JSON.parse(privateJwk) : privateJwk;
  const key = await crypto.subtle.importKey('jwk', { ...jwk, alg: 'RS256', ext: true }, ALG, false, ['sign']);
  const payload = new TextEncoder().encode(p.payload(clean(name), clean(email), exp, clean(plan)));
  const sig = new Uint8Array(await crypto.subtle.sign(ALG.name, key, payload));
  return p.prefix + b64url(payload) + '.' + b64url(sig);
}

/** Returns { product, name, email, exp, plan } when the signature is valid, otherwise null. Expired keys still parse. */
export async function readKey(text, publicJwk = PUBLIC_JWK) {
  const key = String(text || '').replace(/\s/g, '');
  const m = key.match(/^(SC1|NP1)-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const pub = await crypto.subtle.importKey('jwk', { ...publicJwk, alg: 'RS256', ext: true }, ALG, false, ['verify']);
    const payload = fromB64url(m[2]);
    if (!(await crypto.subtle.verify(ALG.name, pub, fromB64url(m[3]), payload))) return null;
    const parts = new TextDecoder().decode(payload).split('|');
    if (m[1] === 'SC1' && parts.length >= 4) return { product: 'tidyup', key, name: parts[0], email: parts[1], exp: parts[2], plan: parts[3] };
    if (m[1] === 'NP1' && parts.length >= 5 && parts[0] === 'NanoPDF') return { product: 'nanopdf', key, name: parts[1], email: parts[2], exp: parts[3], plan: parts[4] };
  } catch { /* malformed key */ }
  return null;
}
