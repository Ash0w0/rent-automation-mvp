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

function generateTempPassword(length = TEMP_PASSWORD_LENGTH) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }

  return out;
}

module.exports = {
  generateTempPassword,
  hashPassword,
  verifyPassword,
};
