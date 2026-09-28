import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { test } from 'node:test';
import { isPassNext, passPage, signPass } from '../src/nanoshare.js';

function keyEnv() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = privateKey.export({ format: 'jwk' });
  return { privateKey, NANOSHARE_PASS_JWK: Buffer.from(JSON.stringify(jwk)).toString('base64') };
}

test('pass: payload.signature, ECDSA P-256 over the payload part (raw r||s)', async () => {
  const env = keyEnv();
  const pass = await signPass(env, { v: 1, sub: 'u1', name: 'สมชาย', tier: 'supporter', exp: 2000000000 });
  const [body, sig] = pass.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')), { v: 1, sub: 'u1', name: 'สมชาย', tier: 'supporter', exp: 2000000000 });
  const raw = Buffer.from(sig, 'base64url');
  assert.equal(raw.length, 64);
  assert.ok(verify('sha256', Buffer.from(body), { key: createPublicKey(env.privateKey), dsaEncoding: 'ieee-p1363' }, raw));
});

test('sign-in may return only to the pass page with a plain query', () => {
  assert.ok(isPassNext('/api/nanoshare/pass?to=web'));
  assert.ok(isPassNext('/api/nanoshare/pass?to=app&port=51234&state=abcDEF_123-xyzxyzxyz'));
  assert.ok(!isPassNext('/api/nanoshare/pass'));
  assert.ok(!isPassNext('https://evil.example/api/nanoshare/pass?to=web'));
  assert.ok(!isPassNext('/api/nanoshare/pass?to=web;x'));
  assert.ok(!isPassNext('/account'));
});

function fakeDb(user, supporter) {
  return {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes('FROM sessions')) return user;
          if (sql.includes('nanoshare_supporter')) return { nanoshare_supporter: supporter ? 1 : 0 };
          return null;
        },
      };
    },
  };
}

const req = cookie => new Request('https://nanohash.biz/x', { headers: cookie ? { cookie } : {} });

test('pass page: signed out goes to Google sign-in and comes back', async () => {
  const env = { ...keyEnv(), DB: fakeDb(null) };
  const url = new URL('https://nanohash.biz/api/nanoshare/pass?to=web');
  const res = await passPage(req(), env, url, url);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/api/auth/google?next=' + encodeURIComponent('/api/nanoshare/pass?to=web'));
});

test('pass page: web gets the pass in the fragment, app on 127.0.0.1 with its state', async () => {
  const env = { ...keyEnv(), DB: fakeDb({ id: 'u1', email: 'a@b.c', name: 'A' }, true) };
  const web = await passPage(req('nh_session=t'), env, new URL('https://nanohash.biz/api/nanoshare/pass?to=web'), null);
  const loc = web.headers.get('location');
  assert.match(loc, /^https:\/\/share\.nanohash\.biz\/#pass=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const payload = JSON.parse(Buffer.from(loc.split('#pass=')[1].split('.')[0], 'base64url').toString());
  assert.equal(payload.tier, 'supporter');
  assert.ok(payload.exp > Date.now() / 1000 + 100 * 86400);

  const app = await passPage(req('nh_session=t'), env, new URL('https://nanohash.biz/api/nanoshare/pass?to=app&port=51234&state=abcdefghijklmnop'), null);
  assert.match(app.headers.get('location'), /^http:\/\/127\.0\.0\.1:51234\/nanoshare-pass\?state=abcdefghijklmnop&pass=/);
});

test('pass page: refuses odd ports and states', async () => {
  const env = { ...keyEnv(), DB: fakeDb({ id: 'u1', email: 'a@b.c', name: 'A' }, false) };
  for (const q of ['to=app&port=80&state=abcdefghijklmnop', 'to=app&port=51234&state=short', 'to=evil']) {
    const res = await passPage(req('nh_session=t'), env, new URL(`https://nanohash.biz/api/nanoshare/pass?${q}`), null);
    assert.equal(res.status, 400, q);
  }
});
