const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const PlatformAdmin = require("../models/PlatformAdmin");
const {
  createTenantModelProxies,
  getTenantModels,
  runWithTenantModels,
} = require("../utils/tenantModels");
const provisionClient = require("../utils/provisionClient");

let mongo;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test("provisions isolated properties, units, admins, and tenant records", async () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const passwordA = "owner-password-alpha";
  const passwordB = "owner-password-bravo";
  const clientA = {
    subdomain: `alpha-${suffix}`,
    email: `alpha-${suffix}@example.com`,
    contactName: "Alpha Owner",
    passwordHash: await bcrypt.hash(passwordA, 10),
    locations: [`Alpha Property ${suffix}`],
  };
  const clientB = {
    subdomain: `bravo-${suffix}`,
    email: `bravo-${suffix}@example.com`,
    contactName: "Bravo Owner",
    passwordHash: await bcrypt.hash(passwordB, 10),
    locations: [`Bravo Property ${suffix}`],
  };

  const [dbA, dbB] = await Promise.all([
    provisionClient(clientA),
    provisionClient(clientB),
  ]);
  const modelsA = getTenantModels(dbA);
  const modelsB = getTenantModels(dbB);
  const propertyA = await modelsA.Property.findOne({
    name: clientA.locations[0],
  });
  const propertyB = await modelsB.Property.findOne({
    name: clientB.locations[0],
  });
  const unitA = await modelsA.Unit.findOne({ propertyId: propertyA._id });
  const unitB = await modelsB.Unit.findOne({ propertyId: propertyB._id });

  assert.equal(await modelsA.Unit.countDocuments(), 10);
  assert.equal(await modelsB.Unit.countDocuments(), 10);
  assert.ok(propertyA);
  assert.ok(propertyB);

  await modelsA.User.create({
    location: propertyA.name,
    propertyId: propertyA._id,
    unitId: unitA._id,
    name: "Tenant Alpha",
    email: `tenant-alpha-${suffix}@example.com`,
    phone: "08000000001",
    session: "2026/2027",
    roomNo: unitA.label,
  });
  await modelsB.User.create({
    location: propertyB.name,
    propertyId: propertyB._id,
    unitId: unitB._id,
    name: "Tenant Bravo",
    email: `tenant-bravo-${suffix}@example.com`,
    phone: "08000000002",
    session: "2026/2027",
    roomNo: unitB.label,
  });

  assert.equal(await modelsA.User.countDocuments(), 1);
  assert.equal(await modelsB.User.countDocuments(), 1);
  assert.equal(
    await modelsA.User.countDocuments({
      email: `tenant-bravo-${suffix}@example.com`,
    }),
    0,
  );

  const ownerA = await modelsA.Admin.findOne({ email: clientA.email });
  assert.equal(await ownerA.comparePassword(passwordA), true);
  assert.equal(await ownerA.comparePassword(passwordB), false);

  const sharedModels = createTenantModelProxies();
  const proxiedCount = await new Promise((resolve, reject) => {
    runWithTenantModels(modelsA, async () => {
      try {
        resolve(await sharedModels.User.countDocuments());
      } catch (error) {
        reject(error);
      }
    });
  });
  assert.equal(proxiedCount, 1);
});

test("creates platform admins with a working password hash", async () => {
  const admin = await PlatformAdmin.create({
    name: "Test Platform Admin",
    email: `platform-${Date.now()}@example.com`,
    password: "platform-test-password",
  });

  assert.equal(await admin.comparePassword("platform-test-password"), true);
  assert.equal(await admin.comparePassword("wrong-password"), false);
});
