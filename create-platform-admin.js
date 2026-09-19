// Run locally with: node create-platform-admin.js
// Delete this file or keep it out of deployments after creating the admin.

require("dotenv").config();
const mongoose = require("mongoose");
const PlatformAdmin = require("./models/PlatformAdmin");

const MONGO_URI = process.env.MONGO_URI;

// Edit these three values before running.
const NAME = "Fawaz";
const EMAIL = "you@yourdomain.com";
const PASSWORD = "choose-a-strong-password";

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set — check your .env file");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const email = EMAIL.toLowerCase();
  const existing = await PlatformAdmin.findOne({ email });
  if (existing) {
    console.log(`A PlatformAdmin with email ${EMAIL} already exists. Nothing created.`);
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
