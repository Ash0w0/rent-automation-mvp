const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(crypto.scrypt);

const HASH_PREFIX = 'scrypt:v1';
const PASSWORD_MIN_LENGTH = 6;
const TEMPORARY_CODE_TTL_DAYS = 14;
const MAX_FAILED_ATTEMPTS = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

function toIso(date) {
  return date.toISOString();
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function assertPasswordIsValid(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
}

function generateTemporaryCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function hashSecret(secret) {
  assertPasswordIsValid(secret);

  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(secret, salt, 32);
  return `${HASH_PREFIX}:${salt.toString('base64')}:${Buffer.from(key).toString('base64')}`;
}

async function verifySecret(secret, storedHash) {
  if (!secret || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const [scheme, version, saltValue, hashValue] = storedHash.split(':');
  if (`${scheme}:${version}` !== HASH_PREFIX || !saltValue || !hashValue) {
    return false;
  }

  const salt = Buffer.from(saltValue, 'base64');
  const expected = Buffer.from(hashValue, 'base64');
  const actual = await scryptAsync(secret, salt, expected.length);

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function isTemporaryCodeActive(credential, now = new Date()) {
  if (!credential?.temporaryCodeHash || !credential.temporaryCodeExpiresAt) {
    return false;
  }

  return new Date(credential.temporaryCodeExpiresAt).getTime() > now.getTime();
}

function isCredentialLocked(credential, now = new Date()) {
  if (!credential?.lockedUntil) {
    return false;
  }

  return new Date(credential.lockedUntil).getTime() > now.getTime();
}

async function buildTemporaryCredentialFields(now = new Date()) {
  const temporaryCode = generateTemporaryCode();
  const expiresAt = addDays(now, TEMPORARY_CODE_TTL_DAYS);

  return {
    temporaryCode,
    fields: {
      passwordHash: null,
      temporaryCodeHash: await hashSecret(temporaryCode),
      temporaryCodeExpiresAt: toIso(expiresAt),
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: toIso(now),
      passwordChangedAt: null,
    },
  };
}

async function buildPermanentPasswordFields(password, now = new Date()) {
  assertPasswordIsValid(password);

  return {
    passwordHash: await hashSecret(password),
    temporaryCodeHash: null,
    temporaryCodeExpiresAt: null,
    mustChangePassword: false,
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: toIso(now),
    passwordChangedAt: toIso(now),
  };
}

module.exports = {
  ACCOUNT_LOCK_MS,
  MAX_FAILED_ATTEMPTS,
  PASSWORD_MIN_LENGTH,
  TEMPORARY_CODE_TTL_DAYS,
  assertPasswordIsValid,
  buildPermanentPasswordFields,
  buildTemporaryCredentialFields,
  generateTemporaryCode,
  hashSecret,
  isCredentialLocked,
  isTemporaryCodeActive,
  verifySecret,
};
