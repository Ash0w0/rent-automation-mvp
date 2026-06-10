const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TEMP_PASSWORD_LENGTH = 10;

async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!hash || typeof hash !== 'string') {
    return false;
  }

  return bcrypt.compare(String(plain || ''), hash);
}

// Hash of a random throwaway value, computed once at startup. Comparing against
// it keeps login latency identical whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

async function dummyPasswordCompare(plain) {
  await bcrypt.compare(String(plain || ''), DUMMY_HASH);
  return false;
}

function generateTempPassword(length = TEMP_PASSWORD_LENGTH) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TEMP_PASSWORD_ALPHABET[crypto.randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }

  return out;
}

module.exports = {
  dummyPasswordCompare,
  generateTempPassword,
  hashPassword,
  verifyPassword,
};
