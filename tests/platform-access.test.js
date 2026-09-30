const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongo;
let server;
let baseUrl;
let ownerToken;
let reviewerToken;
let staffId;
let PlatformStaff;

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "platform-access-test-secret";
  process.env.PLATFORM_ADMIN_NAME = "Platform Test Owner";
  process.env.PLATFORM_ADMIN_EMAIL = "owner-access-test@example.test";
  process.env.PLATFORM_ADMIN_PASSWORD = "owner-access-test-password";

  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  PlatformStaff = require("../models/PlatformStaff");
  await require("../utils/ensurePlatformOwner")();

  const app = express();
  app.use(express.json());
  app.use(require("../routes/platform"));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

test("owner/staff permissions and platform audit are enforced", async () => {
  const ownerLogin = await request("/platform/login", {
    method: "POST",
    body: {
      email: process.env.PLATFORM_ADMIN_EMAIL,
      password: process.env.PLATFORM_ADMIN_PASSWORD,
    },
  });
  assert.equal(ownerLogin.status, 200);
  assert.equal(ownerLogin.body.role, "owner");
  ownerToken = ownerLogin.body.token;

  const staleOwnerToken = jwt.sign(
    {
      id: new mongoose.Types.ObjectId(),
      email: process.env.PLATFORM_ADMIN_EMAIL,
      role: "owner",
      type: "platform",
    },
    process.env.JWT_SECRET,
  );
  assert.equal(
    (await request("/platform/clients", { token: staleOwnerToken })).status,
    401,
  );

  const created = await request("/platform/staff", {
    method: "POST",
    token: ownerToken,
    body: {
      name: "Review Staff",
      email: "review-staff@example.test",
      password: "review-staff-test-password",
      role: "reviewer",
    },
  });
  assert.equal(created.status, 201);
  staffId = created.body.staff._id;

  const reviewerLogin = await request("/platform/login", {
    method: "POST",
    body: {
      email: "review-staff@example.test",
      password: "review-staff-test-password",
    },
  });
  assert.equal(reviewerLogin.status, 200);
  assert.equal(reviewerLogin.body.role, "reviewer");
  reviewerToken = reviewerLogin.body.token;

  assert.equal(
    (await request("/platform/clients", { token: reviewerToken })).status,
    200,
  );
  assert.equal(
    (
      await request("/platform/clients/000000000000000000000001/suspend", {
        method: "PUT",
        token: reviewerToken,
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/platform/staff", { token: reviewerToken })).status,
    403,
  );

  const events = await request("/platform/audit?limit=100", {
    token: ownerToken,
  });
  assert.equal(events.status, 200);
  assert.ok(
    events.body.some((event) => event.action === "platform.login.success"),
  );
  assert.ok(
    events.body.some((event) => event.action === "POST /platform/staff"),
  );

  const signup = await request("/client/signup", {
    method: "POST",
    body: {
      businessName: "Audit Test Property",
      contactName: "Audit Tester",
      email: "audit-test-property@example.test",
      subdomain: "audit-test-property",
      password: "client-test-password",
      locations: ["Audit Test Property"],
    },
  });
  assert.equal(signup.status, 200);
  const auditWithSignup = await request("/platform/audit?limit=100", {
    token: ownerToken,
  });
  assert.ok(
    auditWithSignup.body.some(
      (event) => event.action === "client.signup.created",
    ),
  );

  assert.equal(
    (
      await request(`/platform/staff/${staffId}`, {
        method: "PUT",
        token: ownerToken,
        body: { active: false },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/platform/login", {
        method: "POST",
        body: {
          email: "review-staff@example.test",
          password: "review-staff-test-password",
        },
      })
    ).status,
    401,
  );

  await request("/platform/staff", {
    method: "POST",
    token: ownerToken,
    body: {
      name: "Read Only Staff",
      email: "read-only-staff@example.test",
      password: "read-only-test-password",
      role: "viewer",
    },
  });
  const viewerLogin = await request("/platform/login", {
    method: "POST",
    body: {
      email: "read-only-staff@example.test",
      password: "read-only-test-password",
    },
  });
  assert.equal(viewerLogin.status, 200);
  assert.equal(viewerLogin.body.role, "viewer");
  assert.equal(
    (
      await request("/platform/clients/000000000000000000000001/approve", {
        method: "PUT",
        token: viewerLogin.body.token,
      })
    ).status,
    403,
  );
});
