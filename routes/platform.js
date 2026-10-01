const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const Client = require("../models/Client");
const PlatformAdmin = require("../models/PlatformAdmin");
const PlatformStaff = require("../models/PlatformStaff");
const PlatformAudit = require("../models/PlatformAudit");
const { hasPlatformPermission } = require("../utils/platformPermissions");
const { getTenantModels } = require("../utils/tenantModels");
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

async function recordAudit(req, event) {
  try {
    await PlatformAudit.create({
      actorId: event.actorId || "",
      actorName: event.actorName || "",
      actorEmail: sanitizeEmail(event.actorEmail || "unknown@local"),
      actorRole: event.actorRole || "unknown",
      action: event.action,
      resource: event.resource || "",
      resourceId: String(event.resourceId || ""),
      ipAddress: String(req.ip || "").slice(0, 100),
      userAgent: String(req.get("user-agent") || "").slice(0, 300),
      success: event.success !== false,
    });
  } catch (error) {
    console.error("Platform audit write failed:", error.message);
  }
}

async function verifyPlatformAdmin(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(403).json({ error: "No token" });
  try {
    const d = jwt.verify(token, JWT_SECRET);
    if (
      d.type !== "platform" ||
      !["owner", "reviewer", "viewer"].includes(d.role)
    )
      return res.status(403).json({ error: "Not authorized" });
    if (d.role === "owner") {
      const ownerEmail = sanitizeEmail(process.env.PLATFORM_ADMIN_EMAIL);
      const owner = await PlatformAdmin.findById(d.id);
      if (!owner || owner.email !== ownerEmail || d.email !== ownerEmail)
        return res
          .status(401)
          .json({ error: "Overall admin session is no longer valid" });
    } else {
      const staff = await PlatformStaff.findById(d.id);
      if (!staff || !staff.active || staff.role !== d.role)
        return res.status(401).json({ error: "Staff access is disabled" });
    }
    req.platformAdmin = d;
    await recordAudit(req, {
      actorId: d.id,
      actorName: d.name,
      actorEmail: d.email,
      actorRole: d.role,
      action: `${req.method} ${req.baseUrl}${req.path}`,
      resource: req.baseUrl,
      resourceId: req.params.id,
    });
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

function requirePlatformPermission(...permissions) {
  return (req, res, next) => {
    if (!hasPlatformPermission(req.platformAdmin?.role, permissions)) {
      return res
        .status(403)
        .json({ error: "Insufficient platform permissions" });
    }
    next();
  };
}

function requirePlatformOwner(req, res, next) {
  if (req.platformAdmin?.role !== "owner") {
    return res.status(403).json({ error: "Overall admin access required" });
  }
  next();
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
      return res.status(400).json({
        error: "All required fields, including a location, are required",
      });
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
      return res
        .status(400)
        .json({ error: "Location names must be 50 characters or fewer" });

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
      await recordAudit(req, {
        actorEmail: email,
        actorRole: "client",
        action: "client.signup.email_failed",
        resource: "client",
        resourceId: client._id,
        success: false,
      });
      throw error;
    }

    await recordAudit(req, {
      actorEmail: email,
      actorRole: "client",
      action: "client.signup.created",
      resource: "client",
      resourceId: client._id,
    });

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

    await recordAudit(req, {
      actorId: client._id,
      actorName: client.businessName,
      actorEmail: client.email,
      actorRole: "client",
      action: "client.email.verified",
      resource: "client",
      resourceId: client._id,
    });

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
    await recordAudit(req, {
      actorId: client._id,
      actorName: client.businessName,
      actorEmail: client.email,
      actorRole: "client",
      action: "client.verification.resent",
      resource: "client",
      resourceId: client._id,
    });
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
    const ownerEmail = sanitizeEmail(process.env.PLATFORM_ADMIN_EMAIL);
    let account;
    let role;

    if (email && email === ownerEmail) {
      account = await PlatformAdmin.findOne({ email: ownerEmail });
      role = "owner";
    } else {
      account = await PlatformStaff.findOne({ email, active: true });
      role = account?.role;
    }

    const valid = account && (await account.comparePassword(password));
    if (!valid) {
      await recordAudit(req, {
        actorEmail: email || "unknown@local",
        actorRole: "unknown",
        action: "platform.login.failed",
        success: false,
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (role !== "owner") {
      account.lastLoginAt = new Date();
      await account.save();
    }

    const token = jwt.sign(
      {
        id: account._id,
        email: account.email,
        name: account.name,
        role,
        type: "platform",
      },
      JWT_SECRET,
      { expiresIn: "2h" },
    );
    await recordAudit(req, {
      actorId: account._id,
      actorName: account.name,
      actorEmail: account.email,
      actorRole: role,
      action: "platform.login.success",
    });
    res.json({ token, name: account.name, role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Approval queue ──────────────────────────────────────────────────────
router.get(
  "/platform/clients",
  verifyPlatformAdmin,
  requirePlatformPermission("clients:read"),
  async (req, res) => {
    try {
      const status = sanitizeString(req.query.status); // optional filter
      const filter = status ? { status } : {};
      const clients = await Client.find(
        filter,
        "businessName contactName email phone subdomain status verified rejectionReason approvedAt createdAt locations",
      ).sort({
        createdAt: -1,
      });
      res.json(clients);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

router.put(
  "/platform/clients/:id/approve",
  verifyPlatformAdmin,
  requirePlatformPermission("clients:review"),
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

      const dbName = await provisionClient(client);
      client.dbName = dbName;
      client.status = "active";
      client.approvedAt = new Date();
      await client.save();

      res.json({
        message: `${client.businessName} approved`,
        client: await Client.findById(
          client._id,
          "businessName contactName email phone subdomain status verified approvedAt createdAt locations",
        ),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

router.put(
  "/platform/clients/:id/reject",
  verifyPlatformAdmin,
  requirePlatformPermission("clients:review"),
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

router.put(
  "/platform/clients/:id/suspend",
  verifyPlatformAdmin,
  requirePlatformPermission("clients:manage"),
  async (req, res) => {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { status: "suspended" },
      { returnDocument: "after" },
    );
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json({ message: "Client suspended" });
  },
);

router.put(
  "/platform/clients/:id/reactivate",
  verifyPlatformAdmin,
  requirePlatformPermission("clients:manage"),
  async (req, res) => {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, status: "suspended" },
      { status: "active" },
      { returnDocument: "after" },
    );
    if (!client)
      return res.status(404).json({ error: "Suspended client not found" });
    res.json({ message: "Client reactivated" });
  },
);

router.get(
  "/platform/staff",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    const staff = await PlatformStaff.find({}, "-password").sort({
      createdAt: -1,
    });
    res.json(staff);
  },
);

router.post(
  "/platform/staff",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    const name = sanitizeString(req.body.name);
    const email = sanitizeEmail(req.body.email);
    const password = sanitizeString(req.body.password);
    const role = sanitizeString(req.body.role || "viewer");
    if (!name || !isValidEmail(email) || password.length < 12)
      return res.status(400).json({
        error:
          "Name, valid email, and a password of at least 12 characters are required",
      });
    if (!["reviewer", "viewer"].includes(role))
      return res.status(400).json({ error: "Invalid staff role" });
    if (email === sanitizeEmail(process.env.PLATFORM_ADMIN_EMAIL))
      return res
        .status(409)
        .json({ error: "That email belongs to the overall admin" });
    if (
      (await PlatformStaff.exists({ email })) ||
      (await PlatformAdmin.exists({ email }))
    ) {
      return res
        .status(409)
        .json({ error: "Email already has platform access" });
    }
    const staff = await PlatformStaff.create({ name, email, password, role });
    res.status(201).json({
      staff: await PlatformStaff.findById(staff._id, "-password"),
    });
  },
);

router.put(
  "/platform/staff/:id",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    const updates = {};
    if (typeof req.body.active === "boolean") updates.active = req.body.active;
    if (req.body.role != null) {
      if (!["reviewer", "viewer"].includes(req.body.role))
        return res.status(400).json({ error: "Invalid staff role" });
      updates.role = req.body.role;
    }
    const staff = await PlatformStaff.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        returnDocument: "after",
        runValidators: true,
        projection: "-password",
      },
    );
    if (!staff)
      return res.status(404).json({ error: "Staff member not found" });
    res.json(staff);
  },
);

router.get(
  "/platform/audit",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
    const events = await PlatformAudit.find()
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(events);
  },
);

// ─── Platform-owner cross-tenant data access ─────────────────────────────────
// All routes below require type=platform AND role=owner.
// They resolve the target tenant's DB using Client.dbName, then query directly
// using getTenantModels — no admin JWT for that tenant is needed.

// Helper: resolve client + tenant models, gate to owner only
async function resolveTenantCtx(req, res) {
  if (req.platformAdmin?.role !== "owner")
    return res.status(403).json({ error: "Overall admin access required" });
  const client = await Client.findById(req.params.clientId).lean();
  if (!client) return res.status(404).json({ error: "Client not found" });
  if (!client.dbName)
    return res
      .status(409)
      .json({ error: "Tenant DB not provisioned yet for this client" });
  const models = getTenantModels(client.dbName);
  return { client, models };
}

// GET /platform/tenants/:clientId/stats
router.get(
  "/platform/tenants/:clientId/stats",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      const { models, client } = ctx;
      const [totalUsers, activeUsers, properties, units] = await Promise.all([
        models.User.countDocuments({}),
        models.User.countDocuments({ status: "active" }),
        models.Property.find({}, "name status").lean(),
        models.Unit.countDocuments({}),
      ]);
      res.json({
        clientId: client._id,
        businessName: client.businessName,
        subdomain: client.subdomain,
        status: client.status,
        totalUsers,
        activeUsers,
        revokedUsers: totalUsers - activeUsers,
        properties: properties.length,
        units,
        locations: client.locations,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// GET /platform/tenants/:clientId/users?page=1&limit=50&search=&status=
router.get(
  "/platform/tenants/:clientId/users",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      const { models } = ctx;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));
      const search = String(req.query.search || "").trim();
      const statusFilter = String(req.query.status || "").trim();

      const filter = {};
      if (search) {
        const re = new RegExp(
          search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i",
        );
        filter.$or = [{ name: re }, { email: re }, { roomNo: re }];
      }
      if (statusFilter && ["active", "revoked"].includes(statusFilter))
        filter.status = statusFilter;

      const [users, total] = await Promise.all([
        models.User.find(filter, "-__v")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        models.User.countDocuments(filter),
      ]);
      res.json({ users, total, page, limit });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// GET /platform/tenants/:clientId/users/:userId
router.get(
  "/platform/tenants/:clientId/users/:userId",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      const user = await ctx.models.User.findById(
        req.params.userId,
        "-__v",
      ).lean();
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// PUT /platform/tenants/:clientId/users/:userId
// Allowed field updates: status ("active"|"revoked"), location, roomNo, session, retainPending
router.put(
  "/platform/tenants/:clientId/users/:userId",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      const ALLOWED = [
        "status",
        "location",
        "roomNo",
        "session",
        "retainPending",
      ];
      const updates = {};
      for (const key of ALLOWED) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (updates.status && !["active", "revoked"].includes(updates.status))
        return res
          .status(400)
          .json({ error: "status must be active or revoked" });
      if (Object.keys(updates).length === 0)
        return res.status(400).json({ error: "No valid fields to update" });

      const user = await ctx.models.User.findByIdAndUpdate(
        req.params.userId,
        updates,
        { returnDocument: "after", runValidators: true },
      ).lean();
      if (!user) return res.status(404).json({ error: "User not found" });
      await recordAudit(req, {
        actorId: req.platformAdmin.id,
        actorName: req.platformAdmin.name,
        actorEmail: req.platformAdmin.email,
        actorRole: req.platformAdmin.role,
        action: "platform:edit-tenant-user",
        resource: `tenant:${req.params.clientId}/user`,
        resourceId: req.params.userId,
      });
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// GET /platform/tenants/:clientId/properties  (rooms/units included)
router.get(
  "/platform/tenants/:clientId/properties",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      const [props, units] = await Promise.all([
        ctx.models.Property.find({}).lean(),
        ctx.models.Unit.find({}).lean(),
      ]);
      const propMap = props.map((p) => ({
        ...p,
        units: units.filter((u) => String(u.propertyId) === String(p._id)),
      }));
      res.json(propMap);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

module.exports = router;
