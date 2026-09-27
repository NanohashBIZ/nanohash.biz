import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { test } from 'node:test';
import { keyHash, signToken } from '../src/activation.js';

test('keyHash is b64url SHA-256 of the key without whitespace', async () => {
  const want = createHash('sha256').update('SC1-abc.def').digest('base64url');
  assert.equal(await keyHash(' SC1-abc.\n def '), want);
});

test('activation token: NHA1 prefix, six fields, verifies with the activation public key', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = privateKey.export({ format: 'jwk' });
  const b64 = Buffer.from(JSON.stringify(jwk)).toString('base64');
  const token = await signToken(b64, { product: 'tidyup', keyHash: 'kh', machine: 'a'.repeat(64), issuedAt: '2026-09-28T00:00:00.000Z', validUntil: '2026-10-28T00:00:00.000Z' });
  const [, body, sig] = token.match(/^NHA1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  const payload = Buffer.from(body, 'base64url');
  assert.deepEqual(payload.toString('utf8').split('|'), ['NHA1', 'tidyup', 'kh', 'a'.repeat(64), '2026-09-28T00:00:00.000Z', '2026-10-28T00:00:00.000Z']);
  assert.ok(verify('sha256', payload, createPublicKey(privateKey), Buffer.from(sig, 'base64url')));
});
