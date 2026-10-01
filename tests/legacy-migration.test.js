const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { after, before, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Client = require("../models/Client");
const Admin = require("../models/Admin");
const Settings = require("../models/Settings");
const Registration = require("../models/Registration");
const User = require("../models/User");
const { getTenantModels } = require("../utils/tenantModels");

const execFileAsync = promisify(execFile);
const dbName = "tenant_legacy-test";
let mongo;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test("dry-runs and migrates a legacy property with owner access", async () => {
  await Settings.create({
    location: "Legacy House",
    rentAmount: 42000,
    roomCount: 2,
  });
  await Registration.create({ session: "2026/2027", open: true });
  await User.create({
    location: "Legacy House",
    name: "Legacy Tenant",
    email: "legacy-tenant@example.test",
    phone: "08000000001",
    session: "2026/2027",
    roomNo: "Room 1",
    passport: "https://res.cloudinary.com/example/passport.jpg",
    idCard: "https://res.cloudinary.com/example/id-card.jpg",
    paymentProof: "https://res.cloudinary.com/example/payment-proof.pdf",
  });

  const env = {
    ...process.env,
    NODE_ENV: "test",
    MONGO_URI: mongo.getUri(),
    LEGACY_MONGO_URI: mongo.getUri(),
    LEGACY_TENANT_BUSINESS_NAME: "Legacy Property Ltd",
    LEGACY_TENANT_CONTACT_NAME: "Legacy Owner",
    LEGACY_TENANT_EMAIL: "legacy-owner@example.test",
    LEGACY_TENANT_SUBDOMAIN: "legacy-test",
    LEGACY_TENANT_OWNER_PASSWORD: "legacy-owner-password",
  };
  const script = require.resolve("../migrate-legacy-tenant.js");
  const dryRun = await execFileAsync(process.execPath, [script], { env });
  assert.match(dryRun.stdout, /"mode": "dry-run"/);
  assert.match(dryRun.stdout, /"writes": false/);
  assert.equal(await User.countDocuments(), 1);
  assert.equal(await Client.countDocuments(), 0);

  const applied = await execFileAsync(process.execPath, [script, "--apply"], {
    env,
  });
  assert.match(applied.stdout, /Migration complete/);
  assert.equal(await User.countDocuments(), 1);

  const tenant = await Client.findOne({ email: env.LEGACY_TENANT_EMAIL });
  assert.ok(tenant);
  assert.equal(tenant.status, "active");
  assert.equal(tenant.dbName, dbName);
  const tenantModels = getTenantModels(dbName);
  assert.equal(await tenantModels.User.countDocuments(), 1);
  const migratedUser = await tenantModels.User.findOne({
    email: "legacy-tenant@example.test",
  });
  const migratedRegistration = await tenantModels.Registration.findOne({
    session: "2026/2027",
  });
  assert.ok(migratedUser.propertyId);
  assert.ok(migratedUser.unitId);
  assert.equal(migratedUser.passport, "https://res.cloudinary.com/example/passport.jpg");
  assert.equal(migratedUser.idCard, "https://res.cloudinary.com/example/id-card.jpg");
  assert.equal(migratedUser.paymentProof, "https://res.cloudinary.com/example/payment-proof.pdf");
  assert.equal(migratedRegistration.open, true);
  const tenantOwner = await tenantModels.Admin.findOne({
    email: env.LEGACY_TENANT_EMAIL,
  });
  assert.equal(tenantOwner.role, "owner");
  assert.equal(
    await tenantOwner.comparePassword(env.LEGACY_TENANT_OWNER_PASSWORD),
    true,
  );
});
