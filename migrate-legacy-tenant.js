require("dotenv").config();

const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Client = require("./models/Client");
const modelNames = [
  "Admin",
  "Registration",
  "Settings",
  "Property",
  "Unit",
  "User",
];
const baseModels = Object.fromEntries(
  modelNames.map((name) => [name, require(`./models/${name}`)]),
);

const TARGET_URI = process.env.MONGO_URI;
const SOURCE_URI = process.env.LEGACY_MONGO_URI || TARGET_URI;
const BUSINESS_NAME = process.env.LEGACY_TENANT_BUSINESS_NAME || "";
const CONTACT_NAME = process.env.LEGACY_TENANT_CONTACT_NAME || "";
const EMAIL = String(process.env.LEGACY_TENANT_EMAIL || "")
  .trim()
  .toLowerCase();
const PHONE = process.env.LEGACY_TENANT_PHONE || "";
const SUBDOMAIN = String(process.env.LEGACY_TENANT_SUBDOMAIN || "decrown")
  .trim()
  .toLowerCase();
const OWNER_PASSWORD = process.env.LEGACY_TENANT_OWNER_PASSWORD || "";
const DB_NAME = `tenant_${SUBDOMAIN}`;
const apply = process.argv.includes("--apply");

function assertConfiguration() {
  if (!TARGET_URI || !SOURCE_URI)
    throw new Error("Set MONGO_URI and optionally LEGACY_MONGO_URI in .env");
  if (!BUSINESS_NAME || !CONTACT_NAME || !EMAIL || OWNER_PASSWORD.length < 12)
    throw new Error(
      "Set LEGACY_TENANT_BUSINESS_NAME, LEGACY_TENANT_CONTACT_NAME, LEGACY_TENANT_EMAIL, and a LEGACY_TENANT_OWNER_PASSWORD of at least 12 characters",
    );
  if (!/^[a-z0-9-]{3,30}$/.test(SUBDOMAIN))
    throw new Error(
      "LEGACY_TENANT_SUBDOMAIN must be 3-30 lowercase letters, digits, or hyphens",
    );
}

function compileModels(connection) {
  return Object.fromEntries(
    modelNames.map((name) => {
      const base = baseModels[name];
      return [
        name,
        connection.models[name] ||
          connection.model(name, base.schema, base.collection.name),
      ];
    }),
  );
}

async function countDocuments(models) {
  const counts = {};
  for (const [name, Model] of Object.entries(models)) {
    counts[name] = await Model.countDocuments();
  }
  return counts;
}

async function copyCollection(source, target) {
  let copied = 0;
  let batch = [];
  const cursor = source.find().lean().cursor();

  for await (const document of cursor) {
    batch.push(document);
    if (batch.length === 500) {
      await target.collection.insertMany(batch, { ordered: true });
      copied += batch.length;
      batch = [];
    }
  }
  if (batch.length) {
    await target.collection.insertMany(batch, { ordered: true });
    copied += batch.length;
  }
  return copied;
}

async function createLegacyInventory(models) {
  const properties = models.Property;
  const units = models.Unit;
  const [settingLocations, userLocations] = await Promise.all([
    models.Settings.distinct("location"),
    models.User.distinct("location"),
  ]);
  const locations = [...new Set([...settingLocations, ...userLocations])];
  if (!locations.length) locations.push("Malete", "Ila-Orangun");

  for (const location of locations) {
    let property = await properties.findOne({ name: location });
    if (!property) property = await properties.create({ name: location });
    let setting = await models.Settings.findOne({ location });
    if (!setting) {
      setting = await models.Settings.create({
        location,
        rentAmount: 0,
        roomCount: 0,
      });
    }

    if ((await units.countDocuments({ propertyId: property._id })) === 0) {
      const roomCount =
        setting.roomCount || (location === "Ila-Orangun" ? 22 : 10);
      await units.insertMany(
        Array.from({ length: roomCount }, (_, index) => ({
          propertyId: property._id,
          location,
          unitCode: `room-${index + 1}`,
          label: `Room ${index + 1}`,
          unitType: "room",
        })),
      );
    }
  }

  const bulk = [];
  const cursor = models.User.find({}).lean().cursor();
  for await (const user of cursor) {
    if (user.propertyId && user.unitId) continue;
    const property = await properties.findOne({ name: user.location });
    if (!property) continue;
    const unit = await units.findOne({
      propertyId: property._id,
      label: user.roomNo,
    });
    if (!unit) continue;
    bulk.push({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { propertyId: property._id, unitId: unit._id } },
      },
    });
    if (bulk.length === 500) await models.User.bulkWrite(bulk.splice(0));
  }
  if (bulk.length) await models.User.bulkWrite(bulk);
  return locations;
}

async function run() {
  assertConfiguration();
  await mongoose.connect(TARGET_URI);
  const sourceConnection = await mongoose
    .createConnection(SOURCE_URI)
    .asPromise();
  try {
    if (mongoose.connection.name === DB_NAME)
      throw new Error(
        "Target tenant database must differ from the platform metadata database",
      );
    const sourceModels = compileModels(sourceConnection);
    const sourceCounts = await countDocuments(sourceModels);
    const existingClient = await Client.findOne({
      $or: [{ email: EMAIL }, { subdomain: SUBDOMAIN }],
    });
    const targetConnection = mongoose.connection.useDb(DB_NAME, {
      useCache: true,
    });
    const targetModels = compileModels(targetConnection);
    const targetCounts = await countDocuments(targetModels);
    const targetHasData = Object.values(targetCounts).some(
      (count) => count > 0,
    );

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          businessName: BUSINESS_NAME,
          contactEmail: EMAIL,
          subdomain: SUBDOMAIN,
          targetDatabase: DB_NAME,
          sourceCounts,
          targetCounts,
          existingClient: !!existingClient,
          writes: apply,
        },
        null,
        2,
      ),
    );

    if (!apply) return;
    if (existingClient)
      throw new Error(
        "A client already uses that email or subdomain; refusing to overwrite it",
      );
    if (targetHasData)
      throw new Error(
        "The target tenant database is not empty; refusing to overwrite it",
      );

    for (const name of modelNames) {
      await targetModels[name].init();
      await copyCollection(sourceModels[name], targetModels[name]);
    }

    const locations = await createLegacyInventory(targetModels);
    let tenantOwner = await targetModels.Admin.findOne({ email: EMAIL });
    if (!tenantOwner) {
      tenantOwner = new targetModels.Admin({
        name: CONTACT_NAME,
        email: EMAIL,
        password: OWNER_PASSWORD,
        role: "owner",
      });
    } else {
      tenantOwner.name = CONTACT_NAME;
      tenantOwner.password = OWNER_PASSWORD;
      tenantOwner.role = "owner";
    }
    await tenantOwner.save();

    const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
    await Client.create({
      businessName: BUSINESS_NAME,
      contactName: CONTACT_NAME,
      email: EMAIL,
      phone: PHONE,
      subdomain: SUBDOMAIN,
      passwordHash,
      status: "active",
      verified: true,
      approvedAt: new Date(),
      dbName: DB_NAME,
      locations,
    });
    console.log("Migration complete. Source database was not modified.");
  } finally {
    await sourceConnection.close();
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(
    "Migration stopped without changing the source:",
    error.message,
  );
  process.exitCode = 1;
});
