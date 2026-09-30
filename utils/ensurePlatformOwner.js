const PlatformAdmin = require("../models/PlatformAdmin");

async function ensurePlatformOwner() {
  const name = String(process.env.PLATFORM_ADMIN_NAME || "").trim();
  const email = String(process.env.PLATFORM_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  const password = String(process.env.PLATFORM_ADMIN_PASSWORD || "");

  if (!name || !email || !password) {
    const message =
      "PLATFORM_ADMIN_NAME, PLATFORM_ADMIN_EMAIL, and PLATFORM_ADMIN_PASSWORD must be set";
    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.warn(`${message}; overall-admin login is disabled`);
    return null;
  }
  if (process.env.NODE_ENV === "production" && password.length < 12) {
    throw new Error("PLATFORM_ADMIN_PASSWORD must be at least 12 characters");
  }

  const owner = await PlatformAdmin.findOne().sort({ createdAt: 1 });
  if (!owner) {
    await PlatformAdmin.create({ name, email, password });
    console.log("Overall admin account initialized from environment");
    return true;
  }

  const passwordMatches = await owner.comparePassword(password);
  if (owner.name !== name || owner.email !== email || !passwordMatches) {
    owner.name = name;
    owner.email = email;
    owner.password = password;
    await owner.save();
    console.log("Overall admin account synchronized from environment");
  }
  return true;
}

module.exports = ensurePlatformOwner;
