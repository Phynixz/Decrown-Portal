// Run locally with: node create-platform-admin.js
// Delete this file or keep it out of deployments after creating the admin.

require("dotenv").config();
const mongoose = require("mongoose");
const PlatformAdmin = require("./models/PlatformAdmin");

const MONGO_URI = process.env.MONGO_URI;

// Platform owner credentials can be supplied via environment variables.
const NAME = process.env.PLATFORM_ADMIN_NAME || "";
const EMAIL = process.env.PLATFORM_ADMIN_EMAIL || "";
const PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || "";

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set — check your .env file");
    process.exit(1);
  }
  if (!NAME.trim() || !EMAIL.trim() || PASSWORD.length < 12) {
    console.error(
      "Set PLATFORM_ADMIN_NAME, PLATFORM_ADMIN_EMAIL, and a PLATFORM_ADMIN_PASSWORD of at least 12 characters.",
    );
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const email = EMAIL.toLowerCase();
  const existing = await PlatformAdmin.findOne({ email });
  if (existing) {
    console.log(
      `A PlatformAdmin with email ${EMAIL} already exists. Nothing created.`,
    );
  } else {
    await PlatformAdmin.create({ name: NAME, email, password: PASSWORD });
    console.log(`PlatformAdmin created: ${EMAIL}`);
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Failed to create PlatformAdmin:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
