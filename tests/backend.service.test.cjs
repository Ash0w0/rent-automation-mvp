/**
 * Unit tests for the new password-based auth flows.
 *
 * These tests run without a real database by injecting a lightweight in-memory
 * mock prisma client into createRentBackend({ prisma, skipSeed: true }).
 *
 * Twilio is never configured in this environment, so startPhoneVerification
 * throws "not configured" — which requestPasswordReset intentionally swallows.
 * The daily-cap path is tested by setting TWILIO_DAILY_SMS_CAP=0 and calling
 * resetDailyCounterForTests() to get a fresh counter per test.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Set required env vars before any server module loads
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
// Fake Twilio credentials so isTwilioConfigured() returns true (lets cap check run)
process.env.TWILIO_ACCOUNT_SID = 'ACtest000000000000000000000000000';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_VERIFY_SERVICE_SID = 'VAtest000000000000000000000000000';

const { hashPassword, verifyPassword, generateTempPassword } = require('../server/password');
const { resetDailyCounterForTests, getDailyCounterSnapshot, startPhoneVerification } = require('../server/twilioVerify');
const { createRentBackend } = require('../server/backend');

// ---------------------------------------------------------------------------
// Minimal in-memory prisma mock
// ---------------------------------------------------------------------------

function noop() {}

/**
 * Build a tiny in-memory store that mimics the Prisma model API.
 * Only the operations exercised by the tested code paths are implemented.
 */
function makeStore(initial = {}) {
  return {
    superAdmins: [...(initial.superAdmins || [])],
    owners: [...(initial.owners || [])],
    tenants: [...(initial.tenants || [])],
    authSessions: [...(initial.authSessions || [])],
    auditTrail: [],
    properties: [...(initial.properties || [])],
    tenancies: [...(initial.tenancies || [])],
    invoices: [],
  };
}

function modelMock(storeName, store) {
  return {
    async findFirst({ where } = {}) {
      return store[storeName].find((r) => matchesWhere(r, where)) || null;
    },
    async findUnique({ where } = {}) {
      const [key, value] = Object.entries(where)[0];
      return store[storeName].find((r) => r[key] === value) || null;
    },
    async findMany({ where, orderBy, select } = {}) {
      let result = where ? store[storeName].filter((r) => matchesWhere(r, where)) : [...store[storeName]];
      if (select) {
        result = result.map((r) => {
          const out = {};
          Object.keys(select).forEach((k) => { if (k in r) out[k] = r[k]; });
          return out;
        });
      }
      return result;
    },
    async create({ data } = {}) {
      store[storeName].push({ ...data });
      return { ...data };
    },
    async update({ where, data } = {}) {
      const [key, value] = Object.entries(where)[0];
      const idx = store[storeName].findIndex((r) => r[key] === value);
      if (idx === -1) throw new Error(`${storeName}: record not found`);
      store[storeName][idx] = { ...store[storeName][idx], ...data };
      return { ...store[storeName][idx] };
    },
    async updateMany({ where, data } = {}) {
      store[storeName].forEach((r, i) => {
        if (matchesWhere(r, where)) {
          store[storeName][i] = { ...r, ...data };
        }
      });
      return {};
    },
    async delete({ where } = {}) {
      const [key, value] = Object.entries(where)[0];
      const idx = store[storeName].findIndex((r) => r[key] === value);
      if (idx === -1) throw new Error(`${storeName}: record not found`);
      const [removed] = store[storeName].splice(idx, 1);
      return { ...removed };
    },
    async deleteMany({ where } = {}) {
      const before = store[storeName].length;
      store[storeName] = store[storeName].filter((r) => !matchesWhere(r, where));
      return { count: before - store[storeName].length };
    },
  };
}

function matchesWhere(record, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (condition === null || typeof condition !== 'object') {
      return record[key] === condition;
    }
    // { in: [...] }
    if (Array.isArray(condition.in)) {
      return condition.in.includes(record[key]);
    }
    // { not: value }
    if ('not' in condition) {
      return record[key] !== condition.not;
    }
    return true;
  });
}

function makePrisma(store) {
  const txProxy = {
    superAdmin: modelMock('superAdmins', store),
    owner: modelMock('owners', store),
    tenant: modelMock('tenants', store),
    authSession: modelMock('authSessions', store),
    auditTrail: { create: async ({ data }) => { store.auditTrail.push(data); return data; } },
    property: modelMock('properties', store),
    tenancy: modelMock('tenancies', store),
  };

  return {
    $disconnect: async () => {},
    $transaction: async (fn) => fn(txProxy),
    superAdmin: modelMock('superAdmins', store),
    owner: modelMock('owners', store),
    tenant: modelMock('tenants', store),
    authSession: modelMock('authSessions', store),
    auditTrail: { create: async ({ data }) => { store.auditTrail.push(data); return data; } },
    property: modelMock('properties', store),
    tenancy: modelMock('tenancies', store),
    // getState needs these even when empty
    invoice: { findMany: async () => [], update: async () => ({}) },
    meterReading: { findMany: async () => [] },
    paymentSubmission: { findMany: async () => [] },
    reminder: { findMany: async () => [] },
    room: { findMany: async () => [] },
    settlementAccount: { findFirst: async () => null },
    contract: { findMany: async () => [] },
    roomMeter: { findMany: async () => [] },
  };
}

// Build a backend with the given in-memory store.
async function makeBackend(initial = {}) {
  const store = makeStore(initial);
  const prisma = makePrisma(store);
  const backend = createRentBackend({ prisma, skipSeed: true });
  await backend.ready();
  return { backend, store };
}

// Pre-hash a known password once for convenience.
let KNOWN_HASH;
test.before(async () => {
  KNOWN_HASH = await hashPassword('Passw0rd!');
});

// ---------------------------------------------------------------------------
// password.js — pure unit tests
// ---------------------------------------------------------------------------

test('generateTempPassword returns 10 chars from a safe alphabet', () => {
  const p = generateTempPassword();
  assert.equal(p.length, 10);
  assert.match(p, /^[A-HJ-NP-Za-km-z2-9]+$/);
});

test('hashPassword rejects passwords shorter than 8 chars', async () => {
  await assert.rejects(() => hashPassword('short'), /at least 8/);
});

test('verifyPassword returns true for correct password', async () => {
  const hash = await hashPassword('correct-password');
  assert.equal(await verifyPassword('correct-password', hash), true);
});

test('verifyPassword returns false for wrong password', async () => {
  const hash = await hashPassword('correct-password');
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('verifyPassword returns false when hash is null/undefined', async () => {
  assert.equal(await verifyPassword('anything', null), false);
  assert.equal(await verifyPassword('anything', undefined), false);
});

// ---------------------------------------------------------------------------
// twilioVerify — daily cap
// ---------------------------------------------------------------------------

test('daily cap throws TWILIO_DAILY_CAP_EXCEEDED via startPhoneVerification when cap is 0', async () => {
  resetDailyCounterForTests();
  const old = process.env.TWILIO_DAILY_SMS_CAP;
  process.env.TWILIO_DAILY_SMS_CAP = '0';
  try {
    await assert.rejects(
      () => startPhoneVerification('+19000000001'),
      (err) => {
        assert.equal(err.code, 'TWILIO_DAILY_CAP_EXCEEDED');
        return true;
      },
    );
  } finally {
    if (old === undefined) delete process.env.TWILIO_DAILY_SMS_CAP;
    else process.env.TWILIO_DAILY_SMS_CAP = old;
    resetDailyCounterForTests();
  }
});

test('getDailyCounterSnapshot reflects current count', () => {
  resetDailyCounterForTests();
  const snap = getDailyCounterSnapshot();
  assert.equal(snap.count, 0);
  assert.equal(snap.dateKey, null);
});

// ---------------------------------------------------------------------------
// loginWithPassword
// ---------------------------------------------------------------------------

test('loginWithPassword returns tokens + mustChangePassword for super_admin', async () => {
  const { backend } = await makeBackend({
    superAdmins: [
      {
        id: 'sa-1',
        name: 'Admin',
        phone: '+19000000099',
        passwordHash: KNOWN_HASH,
        mustChangePassword: true,
        createdAt: '2024-01-01',
      },
    ],
  });

  const result = await backend.loginWithPassword({
    role: 'super_admin',
    phone: '+19000000099',
    password: 'Passw0rd!',
  });

  assert.ok(result.tokens?.accessToken, 'should return accessToken');
  assert.ok(result.tokens?.refreshToken, 'should return refreshToken');
  assert.equal(result.mustChangePassword, true);
  assert.equal(result.state?.session?.role, 'super_admin');
});

test('loginWithPassword returns mustChangePassword=false when flag is cleared', async () => {
  const hash = await hashPassword('Passw0rd!');
  const { backend } = await makeBackend({
    superAdmins: [
      { id: 'sa-2', name: 'Admin', phone: '+19000000088', passwordHash: hash, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
  });

  const result = await backend.loginWithPassword({ role: 'super_admin', phone: '+19000000088', password: 'Passw0rd!' });
  assert.equal(result.mustChangePassword, false);
});

test('loginWithPassword rejects wrong password', async () => {
  const { backend } = await makeBackend({
    superAdmins: [
      { id: 'sa-3', name: 'Admin', phone: '+19000000077', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
  });

  await assert.rejects(
    () => backend.loginWithPassword({ role: 'super_admin', phone: '+19000000077', password: 'WrongPass!' }),
    /incorrect/i,
  );
});

test('loginWithPassword rejects account with no password hash', async () => {
  const { backend } = await makeBackend({
    owners: [
      { id: 'ow-1', name: 'Owner', phone: '+19000000066', passwordHash: null, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
  });

  await assert.rejects(
    () => backend.loginWithPassword({ role: 'owner', phone: '+19000000066', password: 'anything!!' }),
    /not yet set up/i,
  );
});

test('loginWithPassword rejects missing fields', async () => {
  const { backend } = await makeBackend();
  await assert.rejects(
    () => backend.loginWithPassword({ role: 'owner', phone: '', password: '' }),
    /required/i,
  );
});

// ---------------------------------------------------------------------------
// changePassword
// ---------------------------------------------------------------------------

test('changePassword updates hash and revokes sessions for owner', async () => {
  const hash = await hashPassword('OldPass01');
  const { backend, store } = await makeBackend({
    owners: [
      { id: 'ow-2', name: 'Owner Two', phone: '+19000000055', passwordHash: hash, mustChangePassword: true, createdAt: '2024-01-01' },
    ],
    authSessions: [
      { id: 'ses-1', role: 'owner', phone: '+19000000055', revokedAt: null, ownerId: 'ow-2' },
    ],
  });

  const session = { role: 'owner', phone: '+19000000055', currentOwnerId: 'ow-2', currentTenantId: null, currentSuperAdminId: null };
  const result = await backend.changePassword({ currentPassword: 'OldPass01', newPassword: 'NewPass02' }, session);
  assert.equal(result.ok, true);

  // mustChangePassword should be cleared
  const owner = store.owners.find((o) => o.id === 'ow-2');
  assert.equal(owner.mustChangePassword, false);

  // Sessions should be deleted
  const sess = store.authSessions.find((s) => s.id === 'ses-1');
  assert.equal(sess, undefined, 'session should be deleted');
});

test('changePassword rejects wrong current password', async () => {
  const hash = await hashPassword('RightPass1');
  const { backend } = await makeBackend({
    owners: [
      { id: 'ow-3', name: 'Owner Three', phone: '+19000000044', passwordHash: hash, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
  });

  const session = { role: 'owner', phone: '+19000000044', currentOwnerId: 'ow-3', currentTenantId: null, currentSuperAdminId: null };
  await assert.rejects(
    () => backend.changePassword({ currentPassword: 'WrongPass1', newPassword: 'NewPass0099' }, session),
    /incorrect/i,
  );
});

// ---------------------------------------------------------------------------
// requestPasswordReset
// ---------------------------------------------------------------------------

test('requestPasswordReset rejects tenant role with owner-mediated message', async () => {
  const { backend } = await makeBackend();
  await assert.rejects(
    () => backend.requestPasswordReset({ role: 'tenant', phone: '+10000000001' }),
    /ask your owner/i,
  );
});

test('requestPasswordReset returns ok for owner (Twilio not configured → error swallowed)', async () => {
  resetDailyCounterForTests();
  const { backend } = await makeBackend({
    owners: [
      { id: 'ow-4', name: 'Owner Four', phone: '+19000000033', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
  });

  // Twilio is not configured → startPhoneVerification throws, error is swallowed
  const result = await backend.requestPasswordReset({ role: 'owner', phone: '+19000000033' });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'pending');
});

test('requestPasswordReset propagates TWILIO_DAILY_CAP_EXCEEDED when cap is 0', async () => {
  resetDailyCounterForTests();
  const old = process.env.TWILIO_DAILY_SMS_CAP;
  process.env.TWILIO_DAILY_SMS_CAP = '0';

  try {
    const { backend } = await makeBackend({
      owners: [
        { id: 'ow-5', name: 'Owner Five', phone: '+19000000022', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
      ],
    });

    await assert.rejects(
      () => backend.requestPasswordReset({ role: 'owner', phone: '+19000000022' }),
      (err) => {
        assert.equal(err.code, 'TWILIO_DAILY_CAP_EXCEEDED');
        return true;
      },
    );
  } finally {
    if (old === undefined) delete process.env.TWILIO_DAILY_SMS_CAP;
    else process.env.TWILIO_DAILY_SMS_CAP = old;
    resetDailyCounterForTests();
  }
});

// ---------------------------------------------------------------------------
// inviteOwner
// ---------------------------------------------------------------------------

test('inviteOwner requires super_admin session', async () => {
  const { backend } = await makeBackend();
  const ownerSession = { role: 'owner', phone: '+10000000001', currentOwnerId: 'ow-x', currentTenantId: null, currentSuperAdminId: null };

  await assert.rejects(
    () => backend.inviteOwner({ name: 'New Owner', phone: '+19000000011' }, ownerSession),
    /only the super admin/i,
  );
});

test('inviteOwner creates owner with hash + mustChangePassword, returns tempPassword (0 Twilio calls)', async () => {
  const { backend, store } = await makeBackend({
    superAdmins: [
      { id: 'sa-10', name: 'Admin', phone: '+19000000099', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
  });

  const saSession = { role: 'super_admin', phone: '+19000000099', currentSuperAdminId: 'sa-10', currentOwnerId: null, currentTenantId: null };

  const twilioSnapshotBefore = getDailyCounterSnapshot().count;

  const result = await backend.inviteOwner({ name: 'New Owner', phone: '+19900000001' }, saSession);

  assert.ok(result.tempPassword, 'should return tempPassword');
  assert.equal(result.owner.name, 'New Owner');
  assert.equal(result.owner.mustChangePassword, true);

  // Owner persisted with hash and flag
  const created = store.owners.find((o) => o.name === 'New Owner');
  assert.ok(created, 'owner should be in store');
  assert.ok(created.passwordHash, 'owner should have passwordHash');
  assert.equal(created.mustChangePassword, true);

  // Confirm temp password verifies against stored hash
  assert.equal(await verifyPassword(result.tempPassword, created.passwordHash), true);

  // No Twilio calls made (counter unchanged)
  assert.equal(getDailyCounterSnapshot().count, twilioSnapshotBefore, 'Twilio counter should not increment for invite');
});

test('inviteOwner rejects duplicate phone', async () => {
  const { backend } = await makeBackend({
    superAdmins: [
      { id: 'sa-11', name: 'Admin', phone: '+19000000099', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
    owners: [
      { id: 'ow-dup', name: 'Existing', phone: '+19900000002', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
  });

  const saSession = { role: 'super_admin', phone: '+19000000099', currentSuperAdminId: 'sa-11', currentOwnerId: null, currentTenantId: null };

  await assert.rejects(
    () => backend.inviteOwner({ name: 'Dup Owner', phone: '+19900000002' }, saSession),
    /already registered/i,
  );
});

// ---------------------------------------------------------------------------
// superAdminResetOwnerPassword
// ---------------------------------------------------------------------------

test('superAdminResetOwnerPassword requires super_admin session', async () => {
  const { backend } = await makeBackend();
  const ownerSession = { role: 'owner', phone: '+10000000001', currentOwnerId: 'ow-x', currentTenantId: null, currentSuperAdminId: null };

  await assert.rejects(
    () => backend.superAdminResetOwnerPassword({ ownerId: 'ow-x' }, ownerSession),
    /only the super admin/i,
  );
});

test('superAdminResetOwnerPassword sets new hash + mustChangePassword + returns tempPassword', async () => {
  const { backend, store } = await makeBackend({
    superAdmins: [
      { id: 'sa-20', name: 'Admin', phone: '+19000000099', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
    owners: [
      { id: 'ow-20', name: 'Owner Twenty', phone: '+19900000020', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
    authSessions: [
      { id: 'ses-20', role: 'owner', phone: '+19900000020', revokedAt: null, ownerId: 'ow-20' },
    ],
  });

  const saSession = { role: 'super_admin', phone: '+19000000099', currentSuperAdminId: 'sa-20', currentOwnerId: null, currentTenantId: null };

  const result = await backend.superAdminResetOwnerPassword({ ownerId: 'ow-20' }, saSession);

  assert.ok(result.tempPassword, 'should return tempPassword');
  assert.equal(result.owner.id, 'ow-20');

  const owner = store.owners.find((o) => o.id === 'ow-20');
  assert.equal(owner.mustChangePassword, true);
  assert.equal(await verifyPassword(result.tempPassword, owner.passwordHash), true);

  const sess = store.authSessions.find((s) => s.id === 'ses-20');
  assert.equal(sess, undefined, 'owner sessions should be deleted');
});

// ---------------------------------------------------------------------------
// ownerResetTenantPassword
// ---------------------------------------------------------------------------

test('ownerResetTenantPassword requires owner session', async () => {
  const { backend } = await makeBackend();
  const tenantSession = { role: 'tenant', phone: '+10000000001', currentTenantId: 'ten-x', currentOwnerId: null, currentSuperAdminId: null };

  await assert.rejects(
    () => backend.ownerResetTenantPassword({ tenantId: 'ten-x' }, tenantSession),
    /only the owner/i,
  );
});

test('ownerResetTenantPassword rejects tenant not in property', async () => {
  const { backend } = await makeBackend({
    owners: [
      { id: 'ow-30', name: 'Owner Thirty', phone: '+19900000030', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
    tenants: [
      { id: 'ten-30', fullName: 'Tenant Thirty', phone: '+19900000031', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
    properties: [
      { id: 'prop-30', ownerId: 'ow-30', name: 'Place', createdAt: '2024-01-01' },
    ],
    // no tenancy linking ten-30 to prop-30
  });

  const ownerSession = { role: 'owner', phone: '+19900000030', currentOwnerId: 'ow-30', currentTenantId: null, currentSuperAdminId: null };

  await assert.rejects(
    () => backend.ownerResetTenantPassword({ tenantId: 'ten-30' }, ownerSession),
    /not part of your property/i,
  );
});

test('ownerResetTenantPassword sets new hash + mustChangePassword + returns tempPassword', async () => {
  const { backend, store } = await makeBackend({
    owners: [
      { id: 'ow-31', name: 'Owner ThirtyOne', phone: '+19900000032', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
    tenants: [
      { id: 'ten-31', fullName: 'Tenant ThirtyOne', phone: '+19900000033', passwordHash: KNOWN_HASH, mustChangePassword: false, createdAt: '2024-01-01' },
    ],
    properties: [
      { id: 'prop-31', ownerId: 'ow-31', name: 'Place', createdAt: '2024-01-01' },
    ],
    tenancies: [
      { id: 'tenancy-31', tenantId: 'ten-31', propertyId: 'prop-31', roomId: 'room-31', status: 'ACTIVE', startDate: '2024-01-01' },
    ],
    authSessions: [
      { id: 'ses-31', role: 'tenant', phone: '+19900000033', revokedAt: null, tenantId: 'ten-31' },
    ],
  });

  const ownerSession = { role: 'owner', phone: '+19900000032', currentOwnerId: 'ow-31', currentTenantId: null, currentSuperAdminId: null };

  const result = await backend.ownerResetTenantPassword({ tenantId: 'ten-31' }, ownerSession);

  assert.ok(result.tempPassword, 'should return tempPassword');
  assert.equal(result.tenant.id, 'ten-31');

  const tenant = store.tenants.find((t) => t.id === 'ten-31');
  assert.equal(tenant.mustChangePassword, true);
  assert.equal(await verifyPassword(result.tempPassword, tenant.passwordHash), true);

  const sess = store.authSessions.find((s) => s.id === 'ses-31');
  assert.equal(sess, undefined, 'tenant sessions should be deleted');
});
