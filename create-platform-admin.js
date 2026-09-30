// Run locally with: node create-platform-admin.js
// Delete this file or keep it out of deployments after creating the admin.

require("dotenv").config();
const mongoose = require("mongoose");
const ensurePlatformOwner = require("./utils/ensurePlatformOwner");

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set — check your .env file");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");
  await ensurePlatformOwner();

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Failed to initialize overall admin:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
