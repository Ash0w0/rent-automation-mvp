const { makeId } = require('../src/lib/rentEngine');
const { buildPhoneCandidates, normalizePhoneNumber } = require('./phoneUtils');
const {
  ACCOUNT_LOCK_MS,
  MAX_FAILED_ATTEMPTS,
  buildPermanentPasswordFields,
  buildTemporaryCredentialFields,
} = require('./passwordAuth');
const { toIso } = require('./auth');

function normalizeCredentialIdentity(identity) {
  const role = String(identity?.role || '').trim();
  if (!['owner', 'tenant'].includes(role)) {
    throw new Error('Credential role must be owner or tenant.');
  }

  return {
    role,
    phone: normalizePhoneNumber(identity.phone),
    ownerId: identity.ownerId || null,
    tenantId: identity.tenantId || null,
  };
}

function buildCredentialLookupWhere(identity) {
  const normalized = normalizeCredentialIdentity(identity);
  const alternatives = [
    {
      phone: {
        in: buildPhoneCandidates(normalized.phone),
      },
    },
  ];

  if (normalized.ownerId) {
    alternatives.push({ ownerId: normalized.ownerId });
  }

  if (normalized.tenantId) {
    alternatives.push({ tenantId: normalized.tenantId });
  }

  return {
    role: normalized.role,
    OR: alternatives,
  };
}

async function findAuthCredential(prisma, identity) {
  return prisma.authCredential.findFirst({
    where: buildCredentialLookupWhere(identity),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

async function issueTemporaryCredential(prisma, identity, now = new Date()) {
  const normalized = normalizeCredentialIdentity(identity);
  const existingCredential = await findAuthCredential(prisma, normalized);
  const { temporaryCode, fields } = await buildTemporaryCredentialFields(now);
  const baseFields = {
    role: normalized.role,
    phone: normalized.phone,
    ownerId: normalized.ownerId,
    tenantId: normalized.tenantId,
  };

  const credential = existingCredential
    ? await prisma.authCredential.update({
        where: { id: existingCredential.id },
        data: {
          ...baseFields,
          ...fields,
        },
      })
    : await prisma.authCredential.create({
        data: {
          id: makeId('credential'),
          ...baseFields,
          ...fields,
          createdAt: toIso(now),
        },
      });

  return {
    credential,
    temporaryCode,
    expiresAt: fields.temporaryCodeExpiresAt,
  };
}

async function setPermanentCredentialPassword(prisma, credential, password, now = new Date()) {
  const fields = await buildPermanentPasswordFields(password, now);
  return prisma.authCredential.update({
    where: { id: credential.id },
    data: fields,
  });
}

async function recordFailedLoginAttempt(prisma, credential, now = new Date()) {
  const failedAttempts = Number(credential.failedAttempts || 0) + 1;
  const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock ? toIso(new Date(now.getTime() + ACCOUNT_LOCK_MS)) : credential.lockedUntil || null;

  return prisma.authCredential.update({
    where: { id: credential.id },
    data: {
      failedAttempts,
      lockedUntil,
      updatedAt: toIso(now),
    },
  });
}

module.exports = {
  buildCredentialLookupWhere,
  findAuthCredential,
  issueTemporaryCredential,
  normalizeCredentialIdentity,
  recordFailedLoginAttempt,
  setPermanentCredentialPassword,
};
