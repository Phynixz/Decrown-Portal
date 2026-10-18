const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// Single-instance session activity registry. A server restart intentionally
// invalidates these sessions rather than guessing their last activity.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const sessions = new Map();

function createAuthToken(payload, secret, expiresIn) {
  const now = Date.now();
  const jti = crypto.randomUUID();
  sessions.set(jti, { lastActivityAt: now });
  if (sessions.size > 10000) {
    for (const [id, session] of sessions) {
      if (now - session.lastActivityAt >= IDLE_TIMEOUT_MS) sessions.delete(id);
    }
  }
  return jwt.sign({ ...payload, jti }, secret, { expiresIn });
}

function touchAuthSession(decoded, { allowLegacy = false, now = Date.now() } = {}) {
  if (!decoded?.jti) return allowLegacy;
  const id = String(decoded.jti);
  const session = sessions.get(id);
  if (!session) return false;
  if (now - session.lastActivityAt >= IDLE_TIMEOUT_MS) {
    sessions.delete(id);
    return false;
  }
  session.lastActivityAt = now;
  return true;
}

module.exports = { createAuthToken, touchAuthSession, IDLE_TIMEOUT_MS };
