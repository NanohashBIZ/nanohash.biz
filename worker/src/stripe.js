// Stripe Checkout for License Keys: one-time payments, Stripe-hosted page, key issued once paid.
// Prices live here on the server; the browser only picks a product and a term.
import { PRODUCTS, expiryFor, signKey } from './license.js';
import { fail, json, nowIso, readJson, str } from './util.js';

const API = 'https://api.stripe.com/v1';
const API_VERSION = '2026-06-24.dahlia';
const CURRENCY = 'thb';
export const PRICES = { '1y': 19900, never: 59900 }; // satang: 199 and 599 THB
const TERM_LABEL = { '1y': { th: '1 ปี', en: '1 year' }, never: { th: 'ตลอดชีพ', en: 'Lifetime' } };
const WEBHOOK_TOLERANCE = 300; // seconds

/** Flattens { a: { b: [x] } } into Stripe's form encoding: a[b][0]=x */
export function formEncode(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(env, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'stripe-version': API_VERSION,
      ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: body ? formEncode(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    // log the Stripe error type/code only, never request data or keys
    console.error('stripe error', res.status, data?.error?.type, data?.error?.code);
    throw Object.assign(new Error('stripe'), { status: res.status });
  }
  return data;
}

export function prices() {
  return json({ currency: CURRENCY, prices: PRICES });
}

export async function createCheckout(req, user, env, site) {
  if (!env.STRIPE_SECRET_KEY) return fail(503, 'payments_off');
  const body = await readJson(req);
  const product = str(body.product, 20);
  const term = str(body.term, 10);
  const name = str(body.name, 80) || user.name;
  const lang = body.lang === 'en' ? 'en' : 'th';
  if (!PRODUCTS[product]) return fail(400, 'product');
  if (!PRICES[term]) return fail(400, 'term');

  const session = await stripe(env, 'POST', '/checkout/sessions', {
    mode: 'payment',
    locale: lang,
    customer_email: user.email,
    client_reference_id: user.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: PRICES[term],
        product_data: {
          name: `${PRODUCTS[product].name} License — ${TERM_LABEL[term][lang]}`,
          description: lang === 'en' ? `License Key for ${name}` : `License Key สำหรับ ${name}`,
        },
      },
    }],
    invoice_creation: { enabled: true },
    automatic_tax: { enabled: env.STRIPE_AUTOMATIC_TAX === 'true' },
    metadata: { product, term, name, user_id: user.id },
    success_url: `${site.origin}/account?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site.origin}/account?cancelled=1`,
  });

  await env.DB.prepare(`INSERT INTO orders (session_id, user_id, email, product, term, display_name, amount, currency, livemode, status, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'open', ?10)`)
    .bind(session.id, user.id, user.email, product, term, name, PRICES[term], CURRENCY, session.livemode ? 1 : 0, nowIso()).run();
  return json({ url: session.url });
}

/** Issues the key for a paid session exactly once. Safe to call from the return page and the webhook. */
async function fulfill(env, session) {
  if (session.payment_status !== 'paid') return null;
  const order = await env.DB.prepare('SELECT * FROM orders WHERE session_id = ?1').bind(session.id).first();
  if (!order) return null;
  if (order.license_id) return order.license_id;
  // claim the order first so a parallel call cannot issue a second key
  const claim = await env.DB.prepare("UPDATE orders SET status = 'paid', paid_at = ?2 WHERE session_id = ?1 AND status = 'open'")
    .bind(session.id, nowIso()).run();
  if (!claim.meta.changes) return null;
  try {
    const exp = expiryFor(order.term);
    const key = await signKey(env.LICENSE_PRIVATE_JWK, order.product, order.display_name, order.email, exp);
    const res = await env.DB.prepare(`INSERT INTO licenses (product, email, name, exp, plan, license_key, status, note, created_at, created_by)
      VALUES (?1, ?2, ?3, ?4, 'pro', ?5, 'active', ?6, ?7, 'stripe')`)
      .bind(order.product, order.email, order.display_name, exp, key, `stripe ${session.id}`, nowIso()).run();
    const licenseId = res.meta.last_row_id;
    await env.DB.prepare('UPDATE orders SET license_id = ?2 WHERE session_id = ?1').bind(session.id, licenseId).run();
    return licenseId;
  } catch (e) {
    // release the claim so the next return-page visit or webhook retry can try again
    await env.DB.prepare("UPDATE orders SET status = 'open' WHERE session_id = ?1 AND license_id IS NULL").bind(session.id).run();
    throw e;
  }
}

/** Return page: the signed-in owner of the session asks us to confirm it. */
export async function confirm(user, env, sessionId) {
  const order = await env.DB.prepare('SELECT user_id FROM orders WHERE session_id = ?1').bind(sessionId).first();
  if (!order || order.user_id !== user.id) return fail(404, 'not_found');
  const session = await stripe(env, 'GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  const licenseId = await fulfill(env, session);
  return json({ paid: session.payment_status === 'paid', issued: !!licenseId });
}

async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
  return [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
}

const safeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/** Checks the Stripe-Signature header (t=...,v1=...) against the raw body. */
export async function verifySignature(payload, header, secret, now = Date.now() / 1000) {
  const parts = {};
  const v1 = [];
  for (const item of String(header || '').split(',')) {
    const [k, v] = item.split('=');
    if (k === 't') parts.t = v;
    if (k === 'v1') v1.push(v);
  }
  if (!parts.t || !v1.length || Math.abs(now - Number(parts.t)) > WEBHOOK_TOLERANCE) return false;
  const expected = await hmacHex(secret, `${parts.t}.${payload}`);
  return v1.some(sig => safeEqual(sig, expected));
}

export async function webhook(req, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return fail(503, 'webhook_off');
  const payload = await req.text();
  if (!(await verifySignature(payload, req.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) return fail(400, 'signature');
  const event = JSON.parse(payload);
  const session = event.data?.object;
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await fulfill(env, session);
  } else if (event.type === 'checkout.session.expired') {
    await env.DB.prepare("UPDATE orders SET status = 'expired' WHERE session_id = ?1 AND status = 'open'").bind(session.id).run();
  }
  return json({ received: true });
}
