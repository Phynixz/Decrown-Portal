const assert = require("node:assert/strict");
const { test } = require("node:test");
const jwt = require("jsonwebtoken");
const { createAuthToken, touchAuthSession, IDLE_TIMEOUT_MS } = require("../utils/authSessions");

const secret = "auth-session-test-secret-that-is-long-enough";

test("issued auth sessions remain valid while active and expire after inactivity", () => {
  const token = createAuthToken({ id: "test-user", type: "platform" }, secret, "2h");
  const decoded = jwt.verify(token, secret);

  assert.ok(decoded.jti, "issued token has a session identifier");
  assert.equal(touchAuthSession(decoded), true);
  assert.equal(
    touchAuthSession(decoded, { now: Date.now() + IDLE_TIMEOUT_MS + 1 }),
    false,
    "an inactive session is rejected after the idle timeout",
  );
  assert.equal(touchAuthSession(decoded), false, "an expired session stays invalid");
});

test("unknown session identifiers and legacy tokens are rejected by default", () => {
  assert.equal(touchAuthSession({ jti: "not-issued-by-this-server" }), false);
  assert.equal(touchAuthSession({ id: "legacy-token" }), false);
  assert.equal(touchAuthSession({ id: "legacy-token" }, { allowLegacy: true }), true);
});
