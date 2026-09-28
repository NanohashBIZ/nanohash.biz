// Fixes from the 2026-09-28 security review.
import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { approve } from '../src/admin.js';
import { callback } from '../src/auth.js';
import { readKey, signKey } from '../src/license.js';
import { readCookies } from '../src/util.js';
import { fakeD1 } from './fake-d1.mjs';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const priv = privateKey.export({ format: 'jwk' });
const pub = createPublicKey(privateKey).export({ format: 'jwk' });

/** A key signed like the site does, with any payload. */
const signed = (prefix, payload) => {
  const body = Buffer.from(payload, 'utf8');
  return `${prefix}${body.toString('base64url')}.${sign('sha256', body, privateKey).toString('base64url')}`;
};

test('an (expired) NanoPDF key re-labelled SC1- is not a TidyUp key', async () => {
  const np1 = await signKey(priv, 'nanopdf', 'Buyer', 'buyer@example.com', '2025-01-01');
  assert.equal(await readKey('SC1-' + np1.slice(4), pub), null);
  assert.equal((await readKey(np1, pub)).product, 'nanopdf'); // the real NanoPDF key still reads
});

test('a TidyUp key re-labelled NP1- is not a NanoPDF key', async () => {
  const sc1 = await signKey(priv, 'tidyup', 'NanoPDF', 'buyer@example.com', '2027-01-01');
  assert.equal(await readKey('NP1-' + sc1.slice(4), pub), null);
});

test('expiry must be never or yyyy-MM-dd', async () => {
  assert.equal(await readKey(signed('SC1-', 'Name|a@b.co|someday|pro'), pub), null);
  assert.equal(await readKey(signed('NP1-', 'NanoPDF|Name|a@b.co|pro|pro'), pub), null);
  assert.equal((await readKey(signed('SC1-', 'Name|a@b.co|never|pro'), pub)).exp, 'never');
  assert.equal((await readKey(signed('SC1-', 'Name|a@b.co|2027-01-31|pro'), pub)).exp, '2027-01-31');
});

test('a customer called "NanoPDF" still gets a working TidyUp key', async () => {
  const key = await signKey(priv, 'tidyup', 'NanoPDF', 'a@b.co', 'never');
  const lic = await readKey(key, pub);
  assert.equal(lic.product, 'tidyup');
  assert.notEqual(lic.name, 'NanoPDF');
});

test('a malformed cookie does not break the request', () => {
  const req = new Request('https://nanohash.biz/', { headers: { cookie: 'bad=%E0%A4%A; nh_session=abc' } });
  assert.deepEqual(readCookies(req), { bad: '%E0%A4%A', nh_session: 'abc' });
});

test('the sign-in callback only goes back to an allowed page', async () => {
  const claims = { aud: 'cid', iss: 'https://accounts.google.com', exp: Date.now() / 1000 + 600, sub: 'g1', email: 'a@b.co', email_verified: true };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id_token: `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s` }));
  try {
    const db = fakeD1();
    const env = { DB: { ...db, batch: stmts => Promise.all(stmts.map(s => s.run())) }, GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'x' };
    const go = async next => {
      const req = new Request('https://nanohash.biz/api/auth/callback?state=s&code=c', { headers: { cookie: `nh_oauth=s v ${next}` } });
      return (await callback(req, env, new URL(req.url), new URL('https://nanohash.biz'))).headers.get('location');
    };
    assert.equal(await go('https://evil.example/'), '/account');   // a planted cookie cannot send people elsewhere
    assert.equal(await go('//evil.example/'), '/account');
    assert.equal(await go('/admin'), '/admin');
    assert.equal(await go('/api/nanoshare/pass?to=web&picked=1'), '/api/nanoshare/pass?to=web&picked=1');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('approving the same request twice issues one key', async () => {
  const DB = fakeD1();
  DB.raw.prepare("INSERT INTO users (id, email, name, created_at, last_login) VALUES ('u1', 'a@b.co', 'A', 'x', 'x')").run();
  DB.raw.prepare(`INSERT INTO requests (user_id, email, product, display_name, status, created_at)
    VALUES ('u1', 'a@b.co', 'tidyup', 'A', 'pending', 'x')`).run();
  const env = { DB, LICENSE_PRIVATE_JWK: JSON.stringify(priv) };
  const post = () => new Request('https://nanohash.biz/', { method: 'POST', body: '{}' });
  const results = await Promise.all([approve(post(), env, { email: 'admin@x' }, 1), approve(post(), env, { email: 'admin@x' }, 1)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 404]);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM licenses').get().n, 1);
});
