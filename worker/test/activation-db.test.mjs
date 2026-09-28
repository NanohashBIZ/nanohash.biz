// /api/activate against a real SQLite database with the production migrations.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { MAX_MACHINES, activate } from '../src/activation.js';
import { removeLicense, revoke } from '../src/admin.js';
import { signKey } from '../src/license.js';
import { fakeD1 } from './fake-d1.mjs';

const pair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { priv: privateKey.export({ format: 'jwk' }), pub: publicKey.export({ format: 'jwk' }) };
};
const license = pair();
const activation = pair();
const machine = c => c.repeat(64);

async function setup() {
  const env = { DB: fakeD1(), ACTIVATION_PRIVATE_JWK: JSON.stringify(activation.priv) };
  const key = await signKey(license.priv, 'nanopdf', 'Test User', 'user@example.com', 'never');
  const send = (m, mode = 'activate', ip = '203.0.113.' + m.charCodeAt(0)) => activate(new Request('https://nanohash.biz/api/activate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ key, machine: m, name: 'PC-' + m[0], app: 'nanopdf', version: '4.8.0', mode }),
  }), env, license.pub).then(async r => ({ status: r.status, ...(await r.json()) }));
  const active = () => env.DB.raw.prepare("SELECT COUNT(*) AS n FROM activations WHERE status = 'active'").get().n;
  const licenseId = () => env.DB.raw.prepare('SELECT id FROM licenses').get().id;
  return { env, key, send, active, licenseId };
}

test('activate, refresh and release one machine', async () => {
  const { send, active } = await setup();
  const a = await send(machine('a'));
  assert.equal(a.status, 200);
  assert.match(a.token, /^NHA1-/);
  assert.equal((await send(machine('a'), 'refresh')).status, 200);
  assert.equal(active(), 1);
  assert.equal((await send(machine('a'), 'release')).released, true);
  assert.equal(active(), 0);
  assert.equal((await send(machine('a'), 'refresh')).error, 'deactivated');
});

test('a third machine gets limit with the names of the other two', async () => {
  const { send } = await setup();
  await send(machine('a'));
  await send(machine('b'));
  const c = await send(machine('c'));
  assert.equal(c.status, 409);
  assert.deepEqual(c.machines.map(m => m.name), ['PC-a', 'PC-b']);
});

test('machines activating at the same moment never exceed the limit', async () => {
  const { send, active } = await setup();
  await send(machine('a'));
  const results = await Promise.all(['b', 'c', 'd', 'e'].map(c => send(machine(c))));
  assert.equal(active(), MAX_MACHINES);
  assert.equal(results.filter(r => r.status === 200).length, MAX_MACHINES - 1);
  assert.ok(results.filter(r => r.status !== 200).every(r => r.error === 'limit'));
});

test('the same machine activating twice at once gets two tokens and one slot', async () => {
  const { send, active } = await setup();
  await send(machine('a'));
  const [x, y] = await Promise.all([send(machine('b')), send(machine('b'))]);
  assert.equal(x.status, 200);
  assert.equal(y.status, 200);
  assert.equal(active(), 2);
});

test('a revoked key that the admin deleted stays blocked', async () => {
  const { env, send, licenseId } = await setup();
  await send(machine('a'));
  await revoke(env, licenseId());
  await removeLicense(env, licenseId());
  const again = await send(machine('b'));
  assert.equal(again.status, 403);
  assert.equal(again.error, 'revoked');
});

test('an active key that the admin deleted stops activating', async () => {
  const { env, send, licenseId, active } = await setup();
  await send(machine('a'));
  await removeLicense(env, licenseId());
  assert.equal(active(), 0);
  assert.equal((await send(machine('b'))).error, 'revoked');
});

test('old rate limit rows are cleaned up', async () => {
  const { env, send } = await setup();
  env.DB.raw.prepare('INSERT INTO rate_limits (k, n, reset_at) VALUES (?1, 1, 1)').run('ip:old');
  await send(machine('a'), 'refresh', '198.51.100.7');
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE k = 'ip:old'").get().n, 0);
});
