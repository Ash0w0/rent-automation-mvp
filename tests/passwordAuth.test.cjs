const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildPermanentPasswordFields,
  buildTemporaryCredentialFields,
  isCredentialLocked,
  isTemporaryCodeActive,
  verifySecret,
} = require('../server/passwordAuth');

test('hashes and verifies a permanent password without storing plain text', async () => {
  const fields = await buildPermanentPasswordFields('secret123', new Date('2026-04-29T00:00:00.000Z'));

  assert.equal(fields.mustChangePassword, false);
  assert.equal(fields.temporaryCodeHash, null);
  assert.notEqual(fields.passwordHash, 'secret123');
  assert.equal(await verifySecret('secret123', fields.passwordHash), true);
  assert.equal(await verifySecret('wrong123', fields.passwordHash), false);
});

test('temporary credential fields expire and require password change', async () => {
  const now = new Date('2026-04-29T00:00:00.000Z');
  const { temporaryCode, fields } = await buildTemporaryCredentialFields(now);

  assert.equal(fields.mustChangePassword, true);
  assert.notEqual(fields.temporaryCodeHash, temporaryCode);
  assert.equal(await verifySecret(temporaryCode, fields.temporaryCodeHash), true);
  assert.equal(isTemporaryCodeActive(fields, now), true);
  assert.equal(isTemporaryCodeActive(fields, new Date('2026-05-20T00:00:00.000Z')), false);
});

test('detects locked credentials by lockedUntil', () => {
  const now = new Date('2026-04-29T00:00:00.000Z');

  assert.equal(isCredentialLocked({ lockedUntil: '2026-04-29T00:05:00.000Z' }, now), true);
  assert.equal(isCredentialLocked({ lockedUntil: '2026-04-28T23:55:00.000Z' }, now), false);
  assert.equal(isCredentialLocked({ lockedUntil: null }, now), false);
});
