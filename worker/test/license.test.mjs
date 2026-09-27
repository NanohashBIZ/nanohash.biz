import assert from 'node:assert/strict';
import { generateKeyPairSync, createPublicKey, verify } from 'node:crypto';
import { test } from 'node:test';
import { expiryFor, readKey, signKey } from '../src/license.js';
import { slipType } from '../src/user.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const priv = privateKey.export({ format: 'jwk' });
const pub = createPublicKey(privateKey).export({ format: 'jwk' });

const parts = key => {
  const [, body, sig] = key.match(/^[A-Z0-9]+-([^.]+)\.(.+)$/);
  return { payload: Buffer.from(body, 'base64url'), sig: Buffer.from(sig, 'base64url') };
};

test('TidyUp key: SC1 prefix, Name|Email|exp|plan, valid RSA SHA-256 signature', async () => {
  const key = await signKey(priv, 'tidyup', 'สมชาย ใจดี', 'a@b.co', '2027-09-27');
  assert.match(key, /^SC1-[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const { payload, sig } = parts(key);
  assert.equal(payload.toString('utf8'), 'สมชาย ใจดี|a@b.co|2027-09-27|pro');
  assert.ok(verify('sha256', payload, privateKey, sig));
});

test('NanoPDF key: NP1 prefix and product field first', async () => {
  const key = await signKey(priv, 'nanopdf', 'A|B', 'a@b.co', 'never');
  assert.ok(key.startsWith('NP1-'));
  assert.equal(parts(key).payload.toString('utf8'), 'NanoPDF|A/B|a@b.co|never|pro');
});

test('readKey accepts own keys and rejects tampered ones', async () => {
  const key = await signKey(priv, 'nanopdf', 'Name', 'a@b.co', 'never');
  assert.deepEqual(await readKey(key, pub), { product: 'nanopdf', key, name: 'Name', email: 'a@b.co', exp: 'never', plan: 'pro' });
  const [head, sig] = key.split('.');
  const tampered = head.slice(0, -2) + (head.at(-2) === 'A' ? 'B' : 'A') + head.at(-1) + '.' + sig;
  assert.equal(await readKey(tampered, pub), null);
  assert.equal(await readKey('SC1-abc.def', pub), null);
  assert.equal(await readKey(key), null, 'the real public key must not accept a test-key signature');
});

test('expiryFor adds one year or returns never', () => {
  assert.equal(expiryFor('1y', new Date('2026-09-27T10:00:00Z')), '2027-09-27');
  assert.equal(expiryFor('never'), 'never');
});

test('slipType sniffs images and PDF, rejects others', () => {
  assert.equal(slipType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(slipType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/png');
  assert.equal(slipType(new TextEncoder().encode('RIFF1234WEBPVP8 ')), 'image/webp');
  assert.equal(slipType(new TextEncoder().encode('%PDF-1.7 hello')), 'application/pdf');
  assert.equal(slipType(new TextEncoder().encode('<html><script>')), null);
});
