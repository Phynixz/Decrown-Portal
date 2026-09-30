const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const Client = require("../models/Client");
const PlatformAdmin = require("../models/PlatformAdmin");
const { sendVerificationEmail } = require("../utils/email");
const provisionClient = require("../utils/provisionClient");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// ─── local sanitizers (mirrors the style already used in server.js) ────────
function sanitizeString(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("\0")) return "";
  return trimmed;
}
function sanitizeEmail(value) {
  return sanitizeString(value).toLowerCase();
}
function isValidEmail(value) {
  return /^[\w.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(
    value,
  );
}
function sanitizeSubdomain(value) {
  return sanitizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "platform",
  "mail",
]);

function generateCode() {
  return String(crypto.randomInt(100000, 999999)); // 6-digit code
}
function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function verifyPlatformAdmin(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(403).json({ error: "No token" });
  try {
    const d = jwt.verify(token, JWT_SECRET);
    if (d.type !== "platform")
      return res.status(403).json({ error: "Not authorized" });
    req.platformAdmin = d;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

// ─── Client signup ───────────────────────────────────────────────────────
router.post("/client/signup", async (req, res) => {
  try {
    const businessName = sanitizeString(req.body.businessName);
    const contactName = sanitizeString(req.body.contactName);
    const email = sanitizeEmail(req.body.email);
    const phone = sanitizeString(req.body.phone);
    const subdomain = sanitizeSubdomain(req.body.subdomain);
    const password = sanitizeString(req.body.password);
    const locations = Array.isArray(req.body.locations)
      ? [...new Set(req.body.locations.map(sanitizeString).filter(Boolean))]
      : [];

    if (
      !businessName ||
      !contactName ||
      !email ||
      !subdomain ||
      !password ||
      !locations.length
    )
      return res
        .status(400)
        .json({ error: "All required fields, including a location, are required" });
    if (!isValidEmail(email))
      return res
        .status(400)
        .json({ error: "Please enter a valid email address" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    if (subdomain.length < 3 || subdomain.length > 30)
      return res
        .status(400)
        .json({ error: "Subdomain must be 3-30 characters" });
    if (RESERVED_SUBDOMAINS.has(subdomain))
      return res.status(400).json({ error: "That subdomain is reserved" });
    if (locations.some((location) => location.length > 50))
      return res.status(400).json({ error: "Location names must be 50 characters or fewer" });

    const existing = await Client.findOne({ $or: [{ email }, { subdomain }] });
    if (existing)
      return res
        .status(409)
        .json({ error: "Email or subdomain already in use" });

    const code = generateCode();
    const passwordHash = await bcrypt.hash(password, 10);

    const client = await Client.create({
      businessName,
      contactName,
      email,
      phone,
      subdomain,
      locations,
      passwordHash,
      verificationCodeHash: hashCode(code),
      verificationExpires: new Date(Date.now() + 15 * 60 * 1000),
      status: "pending_verification",
    });

    try {
      await sendVerificationEmail(email, businessName, code);
    } catch (error) {
      await Client.findByIdAndDelete(client._id);
      throw error;
    }

    res.json({
      message: "Verification code sent to your email",
      clientId: client._id,
      ...(process.env.NODE_ENV !== "production" &&
        !process.env.RESEND_API_KEY && { developmentCode: code }),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Email verification ─────────────────────────────────────────────────
router.post("/client/verify-email", async (req, res) => {
  try {
    const { clientId } = req.body;
    const code = sanitizeString(req.body.code);
    if (!clientId || !code)
      return res.status(400).json({ error: "Client ID and code required" });

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ error: "Signup not found" });
    if (client.verified)
      return res.status(400).json({ error: "Already verified" });
    if (!client.verificationExpires || client.verificationExpires < new Date())
      return res
        .status(400)
        .json({ error: "Code expired — request a new one" });
    if (hashCode(code) !== client.verificationCodeHash)
      return res.status(400).json({ error: "Incorrect code" });

    client.verified = true;
    client.status = "pending_approval";
    client.verificationCodeHash = undefined;
    client.verificationExpires = undefined;
    await client.save();

    res.json({
      message: "Email verified — your account is now pending approval",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/client/resend-code", async (req, res) => {
  try {
    const { clientId } = req.body;
    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ error: "Signup not found" });
    if (client.verified)
      return res.status(400).json({ error: "Already verified" });

    const code = generateCode();
    client.verificationCodeHash = hashCode(code);
    client.verificationExpires = new Date(Date.now() + 15 * 60 * 1000);
    await client.save();

    await sendVerificationEmail(client.email, client.businessName, code);
    res.json({ message: "New code sent" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Platform admin (you) login ─────────────────────────────────────────
router.post("/platform/login", async (req, res) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = sanitizeString(req.body.password);
    const admin = await PlatformAdmin.findOne({ email });
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await admin.comparePassword(password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: admin._id, email: admin.email, name: admin.name, type: "platform" },
      JWT_SECRET,
      { expiresIn: "2h" },
    );
    res.json({ token, name: admin.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Approval queue ──────────────────────────────────────────────────────
router.get("/platform/clients", verifyPlatformAdmin, async (req, res) => {
  try {
    const status = sanitizeString(req.query.status); // optional filter
    const filter = status ? { status } : {};
    const clients = await Client.find(
      filter,
      "-passwordHash -verificationCodeHash",
    ).sort({
      createdAt: -1,
    });
    res.json(clients);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put(
  "/platform/clients/:id/approve",
  verifyPlatformAdmin,
  async (req, res) => {
    try {
      const client = await Client.findById(req.params.id);
      if (!client) return res.status(404).json({ error: "Client not found" });
      if (!client.verified)
        return res
          .status(400)
          .json({ error: "Client has not verified their email yet" });
      if (client.status === "active")
        return res.status(400).json({ error: "Already active" });
      if (!client.locations?.length)
        return res
          .status(400)
          .json({ error: "Client must configure at least one location" });
      if (!client.locations?.length)
        return res
          .status(400)
          .json({ error: "Client must configure at least one location" });

      const dbName = await provisionClient(client);
      client.dbName = dbName;
      client.status = "active";
      client.approvedAt = new Date();
      await client.save();

      res.json({
        message: `${client.businessName} approved`,
        client: await Client.findById(client._id, "-passwordHash -verificationCodeHash"),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

router.put(
  "/platform/clients/:id/reject",
  verifyPlatformAdmin,
  async (req, res) => {
    try {
      const client = await Client.findById(req.params.id);
      if (!client) return res.status(404).json({ error: "Client not found" });
      client.status = "rejected";
      client.rejectionReason =
        sanitizeString(req.body.reason) || "Not specified";
      await client.save();
      res.json({ message: "Client rejected" });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

module.exports = router;
