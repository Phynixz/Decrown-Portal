const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Client = require("../models/Client");
const { getTenantModels } = require("../utils/tenantModels");
const getReceiptAccessError = require("../utils/receiptAccess");

test("receipt access requires an approved application", () => {
  assert.equal(
    getReceiptAccessError({ retainPending: true, disapproved: false }),
    "Receipt unavailable until admin approval.",
  );
  assert.equal(
    getReceiptAccessError({ retainPending: false, disapproved: true }),
    "This application was not approved.",
  );
  assert.equal(
    getReceiptAccessError({ retainPending: false, disapproved: false }),
    "",
  );
});

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

  const reviewerOverview = await request("/platform/overview", { token: reviewerToken });
  assert.equal(reviewerOverview.status, 200);
  assert.equal("operations" in reviewerOverview.body, false, "staff must not receive tenant-wide operational totals");
  assert.equal("system" in reviewerOverview.body, false, "staff must not receive CEO system-readiness details");

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

  const client = await Client.create({
    businessName: "Director Access Property",
    contactName: "Director Test",
    email: "director-access-property@example.test",
    passwordHash: "unused-test-hash",
    subdomain: "director-access-property",
    status: "active",
    verified: true,
    dbName: "tenant_director_access_test",
    locations: ["Director House"],
  });
  const listedClients = await request("/platform/clients?status=active", {
    token: ownerToken,
  });
  const listedClient = listedClients.body.find(
    (entry) => String(entry._id) === String(client._id),
  );
  assert.equal(listedClient.workspaceReady, true);
  assert.equal("dbName" in listedClient, false);
  const tenantModels = getTenantModels(client.dbName);
  const property = await tenantModels.Property.create({
    name: "Director House",
  });
  const overview = await request("/platform/overview", { token: ownerToken });
  assert.equal(overview.status, 200);
  assert.ok(overview.body.clients.active >= 1);
  assert.ok(overview.body.operations.properties >= 1);
  assert.equal(overview.body.system.databaseConnected, true);
  const settings = await request(`/platform/tenants/${client._id}/settings`, {
    token: ownerToken,
  });
  assert.equal(settings.status, 200);
  const savedSettings = await request(
    `/platform/tenants/${client._id}/settings`,
    {
      method: "PUT",
      token: ownerToken,
      body: {
        registrationOpen: false,
        locations: [{ name: property.name, rentAmount: 125000 }],
      },
    },
  );
  assert.equal(savedSettings.status, 200);
  const settingsAfterSave = await request(
    `/platform/tenants/${client._id}/settings`,
    { token: ownerToken },
  );
  assert.equal(settingsAfterSave.body.registrationOpen, false);
  assert.equal(settingsAfterSave.body.locations[0].rentAmount, 125000);

  const propertyUpdate = await request(
    `/platform/tenants/${client._id}/properties/${property._id}`,
    {
      method: "PUT",
      token: ownerToken,
      body: { address: "12 Agency Road" },
    },
  );
  assert.equal(propertyUpdate.status, 200);
  assert.equal(propertyUpdate.body.address, "12 Agency Road");
  assert.equal(
    (
      await request(
        `/platform/tenants/${client._id}/properties/${property._id}`,
        { method: "PUT", token: reviewerToken, body: { status: "archived" } },
      )
    ).status,
    403,
  );

  const newProperty = await request(`/platform/tenants/${client._id}/properties`, {
    method: "POST",
    token: ownerToken,
    body: {
      name: "Director Annex",
      state: "Kwara",
      lga: "Moro",
      propertyType: "apartment",
      rentAmount: 95000,
    },
  });
  assert.equal(newProperty.status, 201);
  const newUnit = await request(
    `/platform/tenants/${client._id}/properties/${newProperty.body._id}/units`,
    {
      method: "POST",
      token: ownerToken,
      body: { unitCode: "annex-1", label: "Annex 1", rentAmount: 95000 },
    },
  );
  assert.equal(newUnit.status, 201);
  const changedUnit = await request(
    `/platform/tenants/${client._id}/properties/${newProperty.body._id}/units/${newUnit.body._id}`,
    {
      method: "PUT",
      token: ownerToken,
      body: { rentAmount: 100000, status: "maintenance" },
    },
  );
  assert.equal(changedUnit.status, 200);
  assert.equal(changedUnit.body.rentAmount, 100000);
  assert.equal(changedUnit.body.status, "maintenance");

  const [assignedUnit, occupiedUnit, availableUnit] =
    await tenantModels.Unit.create([
      {
        propertyId: property._id,
        location: property.name,
        unitCode: "room-1",
        label: "Room 1",
      },
      {
        propertyId: property._id,
        location: property.name,
        unitCode: "room-2",
        label: "Room 2",
      },
      {
        propertyId: property._id,
        location: property.name,
        unitCode: "room-3",
        label: "Room 3",
      },
    ]);
  const tenant = await tenantModels.User.create({
    location: property.name,
    propertyId: property._id,
    unitId: assignedUnit._id,
    name: "Tenant To Manage",
    email: "managed-tenant@example.test",
    phone: "08000000001",
    session: "2026/2027",
    roomNo: assignedUnit.label,
  });
  await tenantModels.User.create({
    location: property.name,
    propertyId: property._id,
    unitId: occupiedUnit._id,
    name: "Existing Occupant",
    email: "existing-occupant@example.test",
    phone: "08000000002",
    session: "2026/2027",
    roomNo: occupiedUnit.label,
  });

  assert.equal(
    (
      await request(`/platform/tenants/${client._id}/properties`, {
        token: ownerToken,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/platform/tenants/${client._id}/stats`, {
        token: reviewerToken,
      })
    ).status,
    403,
  );
  const assigned = await request(
    `/platform/tenants/${client._id}/users/${tenant._id}`,
    {
      method: "PUT",
      token: ownerToken,
      body: {
        propertyId: String(property._id),
        unitId: String(availableUnit._id),
        amount: 125000,
        paymentDate: "2026-09-01",
      },
    },
  );
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.roomNo, "Room 3");
  assert.equal(assigned.body.amount, 125000);
  const occupiedAssignment = await request(
    `/platform/tenants/${client._id}/users/${tenant._id}`,
    {
      method: "PUT",
      token: ownerToken,
      body: {
        propertyId: String(property._id),
        unitId: String(occupiedUnit._id),
      },
    },
  );
  assert.equal(occupiedAssignment.status, 409);
  assert.equal(
    (
      await request(`/platform/tenants/${client._id}/users/${tenant._id}`, {
        method: "PUT",
        token: reviewerToken,
        body: { status: "revoked" },
      })
    ).status,
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
      contactName: "Audit Tester",
      email: "audit-test-property@example.test",
      password: "client-test-password",
    },
  });
  assert.equal(signup.status, 200);
  assert.match(signup.body.subdomain, /^[a-z0-9-]{3,30}$/);
  const pendingLandlord = await Client.findById(signup.body.clientId);
  assert.equal(pendingLandlord.contactName, "Audit Tester");
  assert.equal(pendingLandlord.businessName, "Audit Tester's Portfolio");
  assert.deepEqual(
    pendingLandlord.locations,
    [],
    "signup must not require or create a hostel branch",
  );
  const verification = await request("/client/verify-email", {
    method: "POST",
    body: {
      clientId: signup.body.clientId,
      code: signup.body.developmentCode,
    },
  });
  assert.equal(verification.status, 200);
  const approval = await request(
    `/platform/clients/${signup.body.clientId}/approve`,
    { method: "PUT", token: ownerToken },
  );
  assert.equal(approval.status, 200);
  const approvedClient = await Client.findById(signup.body.clientId);
  const approvedModels = getTenantModels(approvedClient.dbName);
  assert.equal(approvedClient.status, "active");
  assert.equal(await approvedModels.Property.countDocuments(), 0);
  assert.equal(await approvedModels.Admin.countDocuments(), 1);
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
