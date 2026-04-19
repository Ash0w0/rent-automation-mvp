const crypto = require('node:crypto');

const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24;
const REFRESH_TOKEN_TTL_DAYS = 30;
const SESSION_MAX_DAYS = 90;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getJwtSecret() {
  return requireEnv('JWT_SECRET');
}

function getRefreshTokenExpiry(now) {
  const next = new Date(now);
  next.setDate(next.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return next;
}

function getSessionExpiry(now) {
  const next = new Date(now);
  next.setDate(next.getDate() + SESSION_MAX_DAYS);
  return next;
}

function toIso(date) {
  return date.toISOString();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createAccessToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

function createRefreshToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
  });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
  });
}

function buildSessionTokens(session) {
  const basePayload = {
    sid: session.id,
    role: session.role,
    phone: session.phone,
    ownerId: session.ownerId || null,
    tenantId: session.tenantId || null,
  };

  return {
    accessToken: createAccessToken({
      ...basePayload,
      typ: 'access',
    }),
    refreshToken: createRefreshToken({
      ...basePayload,
      typ: 'refresh',
    }),
    accessTokenExpiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenExpiresAt: session.refreshExpiresAt,
    sessionExpiresAt: session.sessionExpiresAt,
  };
}

function createSessionRecord({ id, role, phone, ownerId = null, tenantId = null, now = new Date() }) {
  const refreshExpiresAt = getRefreshTokenExpiry(now);
  const sessionExpiresAt = getSessionExpiry(now);

  return {
    id,
    role,
    phone,
    ownerId,
    tenantId,
    refreshTokenHash: '',
    sessionExpiresAt: toIso(sessionExpiresAt),
    refreshExpiresAt: toIso(refreshExpiresAt),
    createdAt: toIso(now),
    updatedAt: toIso(now),
    lastUsedAt: toIso(now),
    revokedAt: null,
  };
}

function capRefreshExpiry(now, sessionExpiresAt) {
  const refreshExpiry = getRefreshTokenExpiry(now);
  const sessionExpiry = new Date(sessionExpiresAt);
  return refreshExpiry.getTime() < sessionExpiry.getTime() ? refreshExpiry : sessionExpiry;
}

module.exports = {
  ACCESS_TOKEN_TTL_SECONDS,
  buildSessionTokens,
  capRefreshExpiry,
  createSessionRecord,
  hashToken,
  toIso,
  verifyToken,
};
