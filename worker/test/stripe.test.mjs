import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { PRICES, formEncode, verifySignature } from '../src/stripe.js';

test('prices are 199 and 599 THB in satang', () => {
  assert.deepEqual(PRICES, { '1y': 19900, never: 59900 });
});

test('formEncode flattens nested objects and arrays the Stripe way', () => {
  const s = formEncode({ mode: 'payment', line_items: [{ quantity: 1, price_data: { unit_amount: 19900 } }], invoice_creation: { enabled: true }, skip: undefined }).toString();
  assert.equal(decodeURIComponent(s), 'mode=payment&line_items[0][quantity]=1&line_items[0][price_data][unit_amount]=19900&invoice_creation[enabled]=true');
});

const secret = 'whsec_test';
const sign = (payload, t) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;

test('webhook signature: valid, tampered, wrong secret, too old', async () => {
  const body = '{"id":"evt_1"}';
  const t = 1790000000;
  assert.equal(await verifySignature(body, sign(body, t), secret, t + 10), true);
  assert.equal(await verifySignature(body + ' ', sign(body, t), secret, t + 10), false);
  assert.equal(await verifySignature(body, sign(body, t), 'whsec_other', t + 10), false);
  assert.equal(await verifySignature(body, sign(body, t), secret, t + 301), false);
  assert.equal(await verifySignature(body, '', secret, t), false);
});
