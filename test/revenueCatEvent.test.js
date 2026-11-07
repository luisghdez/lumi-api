const test = require('node:test');
const assert = require('node:assert/strict');
const { webhookAuthorized, entitlementUpdate } = require('../src/services/revenueCatEvent');

test('webhook authorization requires the exact configured header', () => {
  assert.equal(webhookAuthorized('Bearer secret', 'Bearer secret'), true);
  assert.equal(webhookAuthorized('Bearer other', 'Bearer secret'), false);
  assert.equal(webhookAuthorized(undefined, 'Bearer secret'), false);
  assert.equal(webhookAuthorized('Bearer secret', ''), false);
});

test('only production Pro lifecycle events change entitlement', () => {
  assert.equal(entitlementUpdate('INITIAL_PURCHASE', 'PRODUCTION', ['Pro']), true);
  assert.equal(entitlementUpdate('RENEWAL', 'PRODUCTION', ['Pro']), true);
  assert.equal(entitlementUpdate('EXPIRATION', 'PRODUCTION', ['Pro']), false);
  assert.equal(entitlementUpdate('CANCELLATION', 'PRODUCTION', ['Pro']), null);
  assert.equal(entitlementUpdate('INITIAL_PURCHASE', 'SANDBOX', ['Pro']), null);
  assert.equal(entitlementUpdate('INITIAL_PURCHASE', 'PRODUCTION', ['Other']), null);
});
