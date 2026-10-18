const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const Client = require("../models/Client");
const PlatformAdmin = require("../models/PlatformAdmin");
const PlatformStaff = require("../models/PlatformStaff");
const PlatformAudit = require("../models/PlatformAudit");
const CentralTenantApplication = require("../models/TenantApplication");
const SharedUser = require("../models/User");
const SharedUnit = require("../models/Unit");
const SharedSettings = require("../models/Settings");
const { hasPlatformPermission } = require("../utils/platformPermissions");
const { getTenantModels } = require("../utils/tenantModels");
const { sendVerificationEmail } = require("../utils/email");
const provisionClient = require("../utils/provisionClient");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || "development";

const { rateLimit } = require("../utils/rateLimit");
const { createAuthToken, touchAuthSession } = require("../utils/authSessions");

// Brute-force protection for credential and verification endpoints.
const platformLoginLimiter = rateLimit({
  name: "platform-login",
  windowMs: 15 * 60 * 1000,
  max: 20,
});
const signupLimiter = rateLimit({
  name: "client-signup",
  windowMs: 60 * 60 * 1000,
  max: 5,
});
const verifyEmailLimiter = rateLimit({
  name: "verify-email",
  windowMs: 15 * 60 * 1000,
  max: 10,
});
const resendCodeLimiter = rateLimit({
  name: "resend-code",
  windowMs: 15 * 60 * 1000,
  max: 5,
});
const clientDeletionLimiter = rateLimit({
  name: "platform-client-delete",
  windowMs: 60 * 60 * 1000,
  max: 10,
});

// Log server errors with detail, but never leak internals to clients in
// production (development keeps the message for local debugging).
function serverError(error) {
  console.error(error);
  return NODE_ENV === "production"
    ? "Server error"
    : error?.message || "Server error";
}

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
function generateTenantSubdomain(businessName) {
  const base = sanitizeSubdomain(businessName).replace(/^-+|-+$/g, "").slice(0, 21);
  return `${base || "landlord"}-${crypto.randomBytes(3).toString("hex")}`;
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
    if (!touchAuthSession(d, { allowLegacy: NODE_ENV !== "production" }))
      return res.status(401).json({ error: "Session expired. Please sign in again." });
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
router.post("/client/signup", signupLimiter, async (req, res) => {
  try {
    const contactName = sanitizeString(
      req.body.contactName || req.body.fullName,
    );
    // A landlord account is not a hostel branch. Keep an internal portfolio
    // label for the existing account/workspace model; the actual hostel name
    // and location are collected later when the landlord adds a branch.
    const businessName =
      sanitizeString(req.body.businessName) ||
      (contactName ? `${contactName}'s Portfolio` : "");
    const email = sanitizeEmail(req.body.email);
    const phone = sanitizeString(req.body.phone);
    const requestedSubdomain = sanitizeSubdomain(req.body.subdomain);
    let subdomain = requestedSubdomain || generateTenantSubdomain(businessName);
    const password = sanitizeString(req.body.password);
    const locations = Array.isArray(req.body.locations)
      ? [...new Set(req.body.locations.map(sanitizeString).filter(Boolean))]
      : [];

    if (!contactName || !email || !password)
      return res.status(400).json({
        error: "Full name, email, and password are required",
      });
    if (!isValidEmail(email))
      return res
        .status(400)
        .json({ error: "Please enter a valid email address" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    if (requestedSubdomain && (subdomain.length < 3 || subdomain.length > 30))
      return res
        .status(400)
        .json({ error: "Subdomain must be 3-30 characters" });
    if (RESERVED_SUBDOMAINS.has(subdomain))
      return res.status(400).json({ error: "That subdomain is reserved" });
    if (locations.some((location) => location.length > 100))
      return res
        .status(400)
        .json({ error: "Location names must be 100 characters or fewer" });

    const existing = await Client.findOne({
      $or: [
        { email },
        ...(requestedSubdomain ? [{ subdomain }] : []),
      ],
    });
    if (existing)
      return res
        .status(409)
        .json({ error: "Email or subdomain already in use" });
    while (await Client.exists({ subdomain }))
      subdomain = generateTenantSubdomain(businessName);

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
      subdomain: client.subdomain,
      ...(process.env.NODE_ENV !== "production" &&
        !process.env.RESEND_API_KEY && { developmentCode: code }),
    });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

// ─── Email verification ─────────────────────────────────────────────────
router.post("/client/verify-email", verifyEmailLimiter, async (req, res) => {
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
    client.status = "active";
    client.verificationCodeHash = undefined;
    client.verificationExpires = undefined;
    const dbName = await provisionClient(client);
    client.dbName = dbName;
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
      message: "Email verified — your landlord account is ready to use. You can now sign in.",
    });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

router.post("/client/resend-code", resendCodeLimiter, async (req, res) => {
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
    res.status(500).json({ error: serverError(e) });
  }
});

// ─── Platform admin (you) login ─────────────────────────────────────────
router.post("/platform/login", platformLoginLimiter, async (req, res) => {
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

    const token = createAuthToken(
      {
        id: account._id,
        email: account.email,
        name: account.name,
        role,
        type: "platform",
      },
      JWT_SECRET,
      "8h",
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
    res.status(500).json({ error: serverError(e) });
  }
});

// ─── Approval queue ──────────────────────────────────────────────────────
// Executive summary: aggregate platform metadata and tenant counts without
// returning tenant records or database names to the browser.
router.get(
  "/platform/overview",
  verifyPlatformAdmin,
  async (req, res) => {
    try {
      // Staff can see the same high-level client queue they are permitted to
      // review, but tenant-wide operational totals and system checks are CEO-only.
      if (req.platformAdmin?.role !== "owner") {
        if (!hasPlatformPermission(req.platformAdmin?.role, ["clients:read"]))
          return res.status(403).json({ error: "Insufficient platform permissions" });
        const visibleClients = await Client.find(
          {},
          "businessName contactName email status verified approvedAt createdAt",
        ).sort({ createdAt: -1 }).limit(100).lean();
        return res.json({
          clients: {
            total: visibleClients.length,
            pendingVerification: visibleClients.filter((client) => client.status === "pending_verification").length,
            pendingApproval: visibleClients.filter((client) => client.status === "pending_approval").length,
            active: visibleClients.filter((client) => client.status === "active").length,
            suspended: visibleClients.filter((client) => client.status === "suspended").length,
            rejected: visibleClients.filter((client) => client.status === "rejected").length,
          },
          recentClients: visibleClients.slice(0, 6),
          recentActivity: [],
        });
      }

      const [totalClients, pendingVerification, pendingApproval, activeClients, suspendedClients, rejectedClients, staffCount, recentClients, recentActivity, tenantClients] = await Promise.all([
        Client.countDocuments({}),
        Client.countDocuments({ status: "pending_verification" }),
        Client.countDocuments({ status: "pending_approval" }),
        Client.countDocuments({ status: "active" }),
        Client.countDocuments({ status: "suspended" }),
        Client.countDocuments({ status: "rejected" }),
        PlatformStaff.countDocuments({ active: true }),
        Client.find({}, "businessName contactName email status verified approvedAt createdAt").sort({ createdAt: -1 }).limit(6).lean(),
        PlatformAudit.find().sort({ createdAt: -1 }).limit(8).lean(),
        Client.find({ status: "active", dbName: { $type: "string", $ne: "" } }, "_id dbName").lean(),
      ]);

      const operations = { tenants: 0, activeTenants: 0, properties: 0, units: 0, pendingHostels: 0, unavailableWorkspaces: 0 };
      await Promise.all(tenantClients.map(async (client) => {
        try {
          const models = getTenantModels(client.dbName);
          const [tenants, activeTenants, properties, units, pendingHostels] = await Promise.all([
            models.User.countDocuments({}),
            models.User.countDocuments({ status: "active" }),
            models.Property.countDocuments({}),
            models.Unit.countDocuments({}),
            models.Property.countDocuments({ status: "pending_review" }),
          ]);
          operations.tenants += tenants;
          operations.activeTenants += activeTenants;
          operations.properties += properties;
          operations.units += units;
          operations.pendingHostels += pendingHostels;
        } catch (error) {
          operations.unavailableWorkspaces += 1;
          console.error("Platform overview could not read a tenant workspace:", error.message);
        }
      }));

      res.json({
        clients: { total: totalClients, pendingVerification, pendingApproval, active: activeClients, suspended: suspendedClients, rejected: rejectedClients },
        operations,
        staff: { active: staffCount },
        recentClients,
        recentActivity,
        system: {
          databaseConnected: mongoose.connection.readyState === 1,
          jwtConfigured: Boolean(JWT_SECRET && JWT_SECRET.length >= 32),
          emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.PLATFORM_EMAIL_FROM),
          cloudStorageConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
        },
      });
    } catch (error) {
      res.status(500).json({ error: serverError(error) });
    }
  },
);

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
        "businessName contactName email phone subdomain status verified rejectionReason approvedAt createdAt locations dbName",
      ).sort({
        createdAt: -1,
      });
      res.json(
        clients.map((client) => {
          const { dbName, ...data } = client.toObject();
          return { ...data, workspaceReady: Boolean(dbName) };
        }),
      );
    } catch (e) {
      res.status(500).json({ error: serverError(e) });
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
      res.status(500).json({ error: serverError(e) });
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
      res.status(500).json({ error: serverError(e) });
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

// Permanent client removal is reserved for the verified overall admin.
// Require the exact business name as a deliberate confirmation. Only drop a
// database whose name matches the tenant naming convention; never guess at a
// legacy database name (for example, a shared database named "test").
router.delete(
  "/platform/clients/:id",
  clientDeletionLimiter,
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id))
        return res.status(400).json({ error: "Invalid client ID" });
      const client = await Client.findById(req.params.id);
      if (!client) return res.status(404).json({ error: "Client not found" });
      if (sanitizeString(req.body.confirmBusinessName) !== client.businessName)
        return res.status(400).json({
          error: "Type the exact business name to confirm client deletion",
        });
      const expectedDbName = `tenant_${client.subdomain}`;
      // Only drop a database created under the tenant naming convention.
      // Legacy/shared databases (for example, "test") must be preserved, but
      // their Client account can still be removed after explicit confirmation.
      const preserveDatabase = Boolean(
        client.dbName && client.dbName !== expectedDbName,
      );

      await recordAudit(req, {
        actorId: req.platformAdmin.id,
        actorName: req.platformAdmin.name,
        actorEmail: req.platformAdmin.email,
        actorRole: "owner",
        action: "client.delete.started",
        resource: "client",
        resourceId: client._id,
      });
      // Delete the platform account first. If database cleanup fails, do not
      // leave a broken landlord record that crashes the dashboard on refresh.
      const removal = await Client.deleteOne({ _id: client._id });
      if (!removal.deletedCount)
        return res.status(409).json({ error: "Client was already removed. Refresh the client list." });
      let databaseCleanupWarning = null;
      if (client.dbName && !preserveDatabase) {
        try {
          const tenantModels = getTenantModels(client.dbName);
          await tenantModels.Admin.db.dropDatabase();
        } catch (cleanupError) {
          databaseCleanupWarning = "The landlord account was deleted, but its database could not be cleaned up automatically. Contact support to remove the orphaned database safely.";
          console.error("Tenant database cleanup failed after client deletion:", cleanupError.message);
          await recordAudit(req, {
            actorId: req.platformAdmin.id,
            actorName: req.platformAdmin.name,
            actorEmail: req.platformAdmin.email,
            actorRole: "owner",
            action: "client.database-cleanup.failed",
            resource: "client-database",
            resourceId: client._id,
            success: false,
          });
        }
      }
      await recordAudit(req, {
        actorId: req.platformAdmin.id,
        actorName: req.platformAdmin.name,
        actorEmail: req.platformAdmin.email,
        actorRole: "owner",
        action: "client.deleted",
        resource: "client",
        resourceId: client._id,
      });
      res.json({
        message: databaseCleanupWarning || (preserveDatabase
          ? "Client account deleted. Its legacy/shared database was preserved and was not changed."
          : "Client and its provisioned tenant database were deleted."),
        deletedClientId: String(client._id),
        deletedDatabase: preserveDatabase || databaseCleanupWarning ? null : client.dbName || null,
        preservedDatabase: preserveDatabase ? client.dbName : null,
        databaseCleanupWarning,
      });
    } catch (error) {
      res.status(500).json({ error: serverError(error) });
    }
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
  if (req.platformAdmin?.role !== "owner") {
    // Send the response and return null — returning res.status().json()
    // directly would be truthy and defeat callers' `if (!ctx) return;` guard.
    res.status(403).json({ error: "Overall admin access required" });
    return null;
  }
  const client = await Client.findById(req.params.clientId).lean();
  if (!client) return res.status(404).json({ error: "Client not found" });
  if (!client.dbName)
    return res
      .status(409)
      .json({ error: "Tenant DB not provisioned yet for this client" });
  const models = getTenantModels(client.dbName);
  return { client, models };
}

function getCurrentSessionLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() >= 7 ? year : year - 1;
  return `${start}/${start + 1}`;
}

function recordDirectorChange(req, action, resource, resourceId) {
  return recordAudit(req, {
    actorId: req.platformAdmin.id,
    actorName: req.platformAdmin.name,
    actorEmail: req.platformAdmin.email,
    actorRole: req.platformAdmin.role,
    action,
    resource,
    resourceId,
  });
}

router.get(
  "/platform/tenants/:clientId/settings",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      const session = getCurrentSessionLabel();
      const [registration, locations] = await Promise.all([
        ctx.models.Registration.findOne({ session }).lean(),
        ctx.models.Settings.find().sort({ location: 1 }).lean(),
      ]);
      res.json({
        session,
        registrationOpen: registration?.open ?? true,
        locations: locations.map(({ location, rentAmount }) => ({
          name: location,
          rentAmount,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: serverError(error) });
    }
  },
);

router.put(
  "/platform/tenants/:clientId/settings",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      const hasLocations = req.body.locations !== undefined;
      const hasRegistration = req.body.registrationOpen !== undefined;
      if (!hasLocations && !hasRegistration)
        return res.status(400).json({ error: "No settings provided" });
      if (hasLocations && !Array.isArray(req.body.locations))
        return res.status(400).json({ error: "Invalid property settings" });
      if (hasRegistration && typeof req.body.registrationOpen !== "boolean")
        return res.status(400).json({ error: "Invalid registration state" });

      if (hasLocations) {
        const seen = new Set();
        for (const item of req.body.locations) {
          const name = sanitizeString(item?.name);
          const rentAmount = Number(item?.rentAmount);
          if (
            !name ||
            !ctx.client.locations.includes(name) ||
            seen.has(name) ||
            !Number.isFinite(rentAmount) ||
            rentAmount < 0
          )
            return res.status(400).json({ error: "Invalid property settings" });
          seen.add(name);
          await ctx.models.Settings.findOneAndUpdate(
            { location: name },
            { location: name, rentAmount },
            { upsert: true, returnDocument: "after", runValidators: true },
          );
        }
      }
      if (hasRegistration) {
        const session = getCurrentSessionLabel();
        await ctx.models.Registration.findOneAndUpdate(
          { session },
          { session, open: req.body.registrationOpen },
          {
            upsert: true,
            returnDocument: "after",
            setDefaultsOnInsert: true,
          },
        );
      }
      await recordDirectorChange(
        req,
        "platform:update-tenant-settings",
        `tenant:${req.params.clientId}/settings`,
        req.params.clientId,
      );
      res.json({ message: "Settings updated" });
    } catch (error) {
      res.status(500).json({ error: serverError(error) });
    }
  },
);

router.post(
  "/platform/tenants/:clientId/properties",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      const name = sanitizeString(req.body.name);
      const state = sanitizeString(req.body.state);
      const lga = sanitizeString(req.body.lga);
      const propertyType = sanitizeString(req.body.propertyType || "hostel").toLowerCase();
      const address = sanitizeString(req.body.address);
      const rentAmount = Number(req.body.rentAmount ?? 0);
      if (
        !name ||
        name.length > 100 ||
        !state ||
        state.length > 60 ||
        !lga ||
        lga.length > 80 ||
        !["hostel", "apartment", "house", "commercial", "mixed", "other"].includes(propertyType) ||
        !Number.isFinite(rentAmount) ||
        rentAmount < 0
      )
        return res.status(400).json({ error: "Invalid property details" });
      if (await ctx.models.Property.exists({ name }))
        return res.status(409).json({ error: "Property already exists" });
      const property = await ctx.models.Property.create({
        name,
        state,
        lga,
        propertyType,
        address,
      });
      await ctx.models.Settings.findOneAndUpdate(
        { location: name },
        { location: name, rentAmount, roomCount: 0 },
        { upsert: true, returnDocument: "after", runValidators: true },
      );
      await Client.updateOne(
        { _id: ctx.client._id },
        { $addToSet: { locations: name } },
      );
      await recordDirectorChange(
        req,
        "platform:create-tenant-property",
        `tenant:${req.params.clientId}/property`,
        property._id,
      );
      res.status(201).json({ ...property.toObject(), units: [] });
    } catch (error) {
      if (error.code === 11000)
        return res.status(409).json({ error: "Property already exists" });
      res.status(500).json({ error: serverError(error) });
    }
  },
);

router.put(
  "/platform/tenants/:clientId/properties/:propertyId",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      if (!mongoose.isValidObjectId(req.params.propertyId))
        return res.status(400).json({ error: "Invalid property ID" });
      const property = await ctx.models.Property.findById(req.params.propertyId);
      if (!property) return res.status(404).json({ error: "Property not found" });
      if (req.body.address !== undefined)
        property.address = sanitizeString(req.body.address);
      for (const field of ["state", "lga"]) {
        if (req.body[field] !== undefined) {
          const value = sanitizeString(req.body[field]);
          if (!value || value.length > (field === "state" ? 60 : 80))
            return res.status(400).json({ error: `Invalid property ${field}` });
          property[field] = value;
        }
      }
      if (req.body.propertyType !== undefined) {
        const propertyType = sanitizeString(req.body.propertyType).toLowerCase();
        if (!["hostel", "apartment", "house", "commercial", "mixed", "other"].includes(propertyType))
          return res.status(400).json({ error: "Invalid property type" });
        property.propertyType = propertyType;
      }
      if (req.body.status !== undefined) {
        if (!["pending_review", "active", "rejected", "archived"].includes(req.body.status))
          return res.status(400).json({ error: "Invalid property status" });
        if (req.body.status === "archived") {
          const occupied = await ctx.models.User.exists({
            session: getCurrentSessionLabel(),
            status: { $ne: "revoked" },
            $or: [
              { propertyId: property._id },
              { location: property.name },
            ],
          });
          if (occupied)
            return res.status(409).json({ error: "Property has current tenants" });
        }
        property.status = req.body.status;
        property.reviewedAt = req.body.status === "active" || req.body.status === "rejected" ? new Date() : null;
      }
      if (req.body.reviewNote !== undefined)
        property.reviewNote = sanitizeString(req.body.reviewNote).slice(0, 500);
      await property.save();
      await recordDirectorChange(
        req,
        req.body.status === "active" ? "platform:approve-hostel" : req.body.status === "rejected" ? "platform:reject-hostel" : "platform:update-tenant-property",
        `tenant:${req.params.clientId}/property`,
        property._id,
      );
      res.json(property);
    } catch (error) {
      res.status(500).json({ error: serverError(error) });
    }
  },
);

router.post(
  "/platform/tenants/:clientId/properties/:propertyId/units",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      if (!mongoose.isValidObjectId(req.params.propertyId))
        return res.status(400).json({ error: "Invalid property ID" });
      const property = await ctx.models.Property.findOne({
        _id: req.params.propertyId,
        status: { $in: ["active", "pending_review"] },
      });
      if (!property) return res.status(404).json({ error: "Property not found" });
      const unitCode = sanitizeString(req.body.unitCode);
      const label = sanitizeString(req.body.label);
      const unitType = sanitizeString(req.body.unitType || "room").toLowerCase();
      const rentAmount = req.body.rentAmount == null || req.body.rentAmount === ""
        ? null
        : Number(req.body.rentAmount);
      if (!unitCode || unitCode.length > 60 || !label || label.length > 100)
        return res.status(400).json({ error: "Unit code and label are required" });
      if (!["room", "apartment", "house", "shop", "office", "other"].includes(unitType))
        return res.status(400).json({ error: "Invalid unit type" });
      if (rentAmount !== null && (!Number.isFinite(rentAmount) || rentAmount < 0))
        return res.status(400).json({ error: "Invalid unit rent" });
      const unit = await ctx.models.Unit.create({
        propertyId: property._id,
        location: property.name,
        unitCode,
        label,
        unitType,
        rentAmount,
      });
      await recordDirectorChange(
        req,
        "platform:create-tenant-unit",
        `tenant:${req.params.clientId}/unit`,
        unit._id,
      );
      res.status(201).json(unit);
    } catch (error) {
      if (error.code === 11000)
        return res.status(409).json({ error: "Unit code or label already exists" });
      res.status(500).json({ error: serverError(error) });
    }
  },
);

router.put(
  "/platform/tenants/:clientId/properties/:propertyId/units/:unitId",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (req, res) => {
    try {
      const ctx = await resolveTenantCtx(req, res);
      if (!ctx) return;
      if (!mongoose.isValidObjectId(req.params.propertyId) || !mongoose.isValidObjectId(req.params.unitId))
        return res.status(400).json({ error: "Invalid property or unit ID" });
      const unit = await ctx.models.Unit.findOne({
        _id: req.params.unitId,
        propertyId: req.params.propertyId,
      });
      if (!unit) return res.status(404).json({ error: "Unit not found" });
      const currentTenant = await ctx.models.User.exists({
        session: getCurrentSessionLabel(),
        status: { $ne: "revoked" },
        $or: [
          { unitId: unit._id },
          { location: unit.location, roomNo: unit.label },
        ],
      });
      if (currentTenant && (req.body.label !== undefined || req.body.status !== undefined && req.body.status !== "available"))
        return res.status(409).json({ error: "Unit has a current tenant" });
      if (req.body.unitCode !== undefined) {
        const unitCode = sanitizeString(req.body.unitCode);
        if (!unitCode || unitCode.length > 60)
          return res.status(400).json({ error: "Invalid unit code" });
        unit.unitCode = unitCode;
      }
      if (req.body.label !== undefined) {
        const label = sanitizeString(req.body.label);
        if (!label || label.length > 100)
          return res.status(400).json({ error: "Invalid unit label" });
        unit.label = label;
      }
      if (req.body.unitType !== undefined) {
        if (!["room", "apartment", "house", "shop", "office", "other"].includes(req.body.unitType))
          return res.status(400).json({ error: "Invalid unit type" });
        unit.unitType = req.body.unitType;
      }
      if (req.body.status !== undefined) {
        if (!["available", "maintenance", "inactive"].includes(req.body.status))
          return res.status(400).json({ error: "Invalid unit status" });
        unit.status = req.body.status;
      }
      if (req.body.rentAmount !== undefined) {
        const rentAmount = req.body.rentAmount === null || req.body.rentAmount === ""
          ? null
          : Number(req.body.rentAmount);
        if (rentAmount !== null && (!Number.isFinite(rentAmount) || rentAmount < 0))
          return res.status(400).json({ error: "Invalid unit rent" });
        unit.rentAmount = rentAmount;
      }
      await unit.save();
      await recordDirectorChange(
        req,
        "platform:update-tenant-unit",
        `tenant:${req.params.clientId}/unit`,
        unit._id,
      );
      res.json(unit);
    } catch (error) {
      if (error.code === 11000)
        return res.status(409).json({ error: "Unit code or label already exists" });
      res.status(500).json({ error: serverError(error) });
    }
  },
);

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
      res.status(500).json({ error: serverError(e) });
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
      res.status(500).json({ error: serverError(e) });
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
      res.status(500).json({ error: serverError(e) });
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
      if (!mongoose.isValidObjectId(req.params.userId))
        return res.status(400).json({ error: "Invalid user ID" });
      const user = await ctx.models.User.findById(req.params.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const updates = {};

      if (req.body.status !== undefined) {
        if (!["active", "revoked"].includes(req.body.status))
          return res
            .status(400)
            .json({ error: "status must be active or revoked" });
        updates.status = req.body.status;
      }
      if (req.body.retainPending !== undefined) {
        if (typeof req.body.retainPending !== "boolean")
          return res.status(400).json({ error: "Invalid retention state" });
        updates.retainPending = req.body.retainPending;
      }
      if (req.body.disapproved !== undefined) {
        if (typeof req.body.disapproved !== "boolean")
          return res.status(400).json({ error: "Invalid review state" });
        updates.disapproved = req.body.disapproved;
        if (!req.body.disapproved) updates.disapprovalReason = null;
      }
      if (req.body.disapprovalReason !== undefined) {
        updates.disapprovalReason = sanitizeString(
          req.body.disapprovalReason,
        ).slice(0, 500);
      }
      if (req.body.revokeReason !== undefined) {
        updates.revokeReason = sanitizeString(req.body.revokeReason).slice(
          0,
          500,
        );
      }
      if (req.body.session !== undefined) {
        const session = sanitizeString(req.body.session);
        if (!session || session.length > 30)
          return res.status(400).json({ error: "Invalid session" });
        updates.session = session;
      }
      if (req.body.amount !== undefined) {
        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount < 0)
          return res.status(400).json({ error: "Invalid payment amount" });
        updates.amount = amount;
      }
      if (req.body.paymentDate !== undefined) {
        updates.paymentDate = sanitizeString(req.body.paymentDate).slice(0, 40);
      }

      const hasPropertyId = req.body.propertyId !== undefined;
      const hasUnitId = req.body.unitId !== undefined;
      if (hasPropertyId !== hasUnitId)
        return res
          .status(400)
          .json({ error: "Property and unit must be assigned together" });
      if (hasPropertyId) {
        if (
          !mongoose.isValidObjectId(req.body.propertyId) ||
          !mongoose.isValidObjectId(req.body.unitId)
        )
          return res.status(400).json({ error: "Invalid property or unit ID" });
        const property = await ctx.models.Property.findOne({
          _id: req.body.propertyId,
          status: "active",
        });
        const unit = await ctx.models.Unit.findOne({
          _id: req.body.unitId,
          propertyId: req.body.propertyId,
          status: "available",
        });
        if (!property || !unit)
          return res
            .status(409)
            .json({ error: "Property or unit is unavailable" });

        const assignmentSession = updates.session || user.session;
        const occupied = await ctx.models.User.exists({
          _id: { $ne: user._id },
          session: assignmentSession,
          $or: [
            { unitId: unit._id },
            { location: property.name, roomNo: unit.label },
          ],
        });
        if (occupied)
          return res
            .status(409)
            .json({ error: "Unit is already assigned for this session" });

        updates.propertyId = property._id;
        updates.unitId = unit._id;
        updates.location = property.name;
        updates.roomNo = unit.label;
      }
      if (req.body.location !== undefined || req.body.roomNo !== undefined) {
        return res
          .status(400)
          .json({ error: "Use propertyId and unitId to change accommodation" });
      }
      if (Object.keys(updates).length === 0)
        return res.status(400).json({ error: "No valid fields to update" });

      Object.assign(user, updates);
      await user.save();
      const savedUser = user.toObject();
      await recordAudit(req, {
        actorId: req.platformAdmin.id,
        actorName: req.platformAdmin.name,
        actorEmail: req.platformAdmin.email,
        actorRole: req.platformAdmin.role,
        action: "platform:manage-tenant-user",
        resource: `tenant:${req.params.clientId}/user`,
        resourceId: req.params.userId,
      });
      res.json(savedUser);
    } catch (e) {
      if (e.code === 11000)
        return res
          .status(409)
          .json({ error: "Accommodation is already assigned" });
      res.status(500).json({ error: serverError(e) });
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
      res.status(500).json({ error: serverError(e) });
    }
  },
);

// CEO review queue: newly submitted landlord hostels stay private until approved.
router.get(
  "/platform/hostels/pending-review",
  verifyPlatformAdmin,
  requirePlatformOwner,
  async (_req, res) => {
    try {
      const clients = await Client.find(
        { status: "active", dbName: { $type: "string", $ne: "" } },
        "businessName contactName email dbName",
      ).lean();
      const results = await Promise.all(clients.map(async (client) => {
        const models = getTenantModels(client.dbName);
        const properties = await models.Property.find({ status: "pending_review" }).lean();
        return Promise.all(properties.map(async (property) => ({
          clientId: String(client._id),
          businessName: client.businessName,
          contactName: client.contactName,
          email: client.email,
          property,
          units: await models.Unit.find({ propertyId: property._id }).sort({ unitCode: 1 }).lean(),
        })));
      }));
      res.json(results.flat().sort((a, b) => new Date(a.property.createdAt) - new Date(b.property.createdAt)));
    } catch (error) {
      res.status(500).json({ error: serverError(error) });
    }
  },
);

async function getApplicationModels(application) {
  if (!application.sourceClientId) {
    return { User: SharedUser, Unit: SharedUnit, Settings: SharedSettings };
  }
  const client = await Client.findOne({ _id: application.sourceClientId, status: "active", dbName: { $type: "string", $ne: "" } }).select("dbName").lean();
  return client?.dbName ? getTenantModels(client.dbName) : null;
}

async function nextApplicationReceiptNumber(location, UserModel) {
  const prefix = String(location || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "RCP";
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const [latest] = await UserModel.aggregate([
    { $match: { location, receiptNumber: { $regex: pattern } } },
    { $project: { found: { $regexFind: { input: "$receiptNumber", regex: pattern } } } },
    { $project: { sequence: { $toInt: { $arrayElemAt: ["$found.captures", 0] } } } },
    { $sort: { sequence: -1 } },
    { $limit: 1 },
  ]);
  return `${prefix}-${year}-${String((latest?.sequence || 0) + 1).padStart(4, "0")}`;
}

// The agency owner can review applications from every active client workspace
// without signing into each landlord account. Uploaded files remain linked to
// the application record and are returned only to the authenticated owner.
router.get("/platform/tenant-applications", verifyPlatformAdmin, requirePlatformOwner, async (_req, res) => {
  try {
    const applications = await CentralTenantApplication.find({}).sort({ createdAt: -1 }).limit(500).lean();
    const clientIds = [...new Set(applications.map((application) => String(application.sourceClientId || "")).filter(Boolean))];
    const clients = clientIds.length ? await Client.find({ _id: { $in: clientIds } }, "businessName status").lean() : [];
    const clientNames = new Map(clients.map((client) => [String(client._id), client.businessName]));
    res.json(applications.map((application) => ({ ...application, clientName: clientNames.get(String(application.sourceClientId || "")) || "De-Crown shared inventory" })));
  } catch (error) {
    res.status(500).json({ error: serverError(error) });
  }
});

router.put("/platform/tenant-applications/:id/status", verifyPlatformAdmin, requirePlatformOwner, async (req, res) => {
  try {
    const application = await CentralTenantApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ error: "Application not found" });
    const nextStatus = sanitizeString(req.body.status);
    const managementNote = sanitizeString(req.body.managementNote).slice(0, 1000);
    const allowed = {
      under_review: ["agreement_requested", "rejected"],
      agreement_submitted: ["payment_unlocked", "rejected"],
      rejected: ["under_review"],
      payment_unlocked: ["rejected"],
    };
    if (!(allowed[application.status] || []).includes(nextStatus)) return res.status(409).json({ error: `Cannot move application from ${application.status} to ${nextStatus}.` });
    const models = await getApplicationModels(application);
    if (!models) return res.status(409).json({ error: "The landlord workspace is no longer available." });
    if (nextStatus === "agreement_requested") {
      const [unit, duplicate] = await Promise.all([
        models.Unit.findOne({ _id: application.unitId, propertyId: application.propertyId, status: "available", $or: [{ applicationHoldId: null }, { applicationHoldId: { $exists: false } }] }),
        models.User.findOne({ location: application.location, roomNo: application.roomNo, session: application.session }),
      ]);
      if (!unit || duplicate) return res.status(409).json({ error: "The requested room is no longer available. Ask the applicant to choose another room." });
    }
    if (nextStatus === "payment_unlocked") {
      const unit = await models.Unit.findOneAndUpdate(
        { _id: application.unitId, propertyId: application.propertyId, status: "available", $or: [{ applicationHoldId: null }, { applicationHoldId: { $exists: false } }] },
        { $set: { applicationHoldId: application._id } },
        { returnDocument: "after" },
      );
      if (!unit) return res.status(409).json({ error: "This room is no longer available to hold. Contact the applicant before accepting payment." });
    }
    if (nextStatus === "rejected" && application.status === "payment_unlocked") {
      await models.Unit.updateOne({ _id: application.unitId, applicationHoldId: application._id }, { $set: { applicationHoldId: null } });
    }
    application.status = nextStatus;
    application.managementNote = managementNote;
    await application.save();
    res.json({ message: `Application updated to ${nextStatus}.`, application });
  } catch (error) {
    res.status(500).json({ error: serverError(error) });
  }
});

router.put("/platform/tenant-applications/:id/verify-payment", verifyPlatformAdmin, requirePlatformOwner, async (req, res) => {
  try {
    const application = await CentralTenantApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ error: "Application not found" });
    if (application.status !== "payment_submitted" || !application.paymentProof || !application.agreementCopy) return res.status(409).json({ error: "A signed agreement and submitted payment proof are required." });
    const models = await getApplicationModels(application);
    if (!models) return res.status(409).json({ error: "The landlord workspace is no longer available." });
    const unit = await models.Unit.findOne({ _id: application.unitId, propertyId: application.propertyId, status: "available", applicationHoldId: application._id });
    if (!unit) return res.status(409).json({ error: "The held room could not be verified. Resolve room availability before allocating." });
    if (await models.User.findOne({ location: application.location, roomNo: application.roomNo, session: application.session })) return res.status(409).json({ error: "This room is already allocated for the selected session." });
    const settings = await models.Settings.findOne({ location: application.location });
    const occupant = await new models.User({
      location: application.location, propertyId: application.propertyId, unitId: application.unitId,
      name: application.name, email: application.email, phone: application.phone,
      guardianName: application.guardianName, guardianPhone: application.guardianPhone,
      session: application.session, level: application.level, roomNo: application.roomNo,
      amount: application.rentAmount || settings?.rentAmount || 0, paymentDate: application.paymentDate,
      passport: application.passport, idCard: application.idCard, agreementCopy: application.agreementCopy,
      paymentProof: application.paymentProof, retainPending: false,
      receiptNumber: await nextApplicationReceiptNumber(application.location, models.User),
    }).save();
    application.status = "allocated";
    application.paymentVerifiedAt = new Date();
    application.allocatedAt = new Date();
    await application.save();
    unit.status = "inactive";
    unit.applicationHoldId = null;
    await unit.save();
    res.json({ message: "Payment verified and room allocated.", tenantId: occupant._id, application });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "This room was allocated by another request. Review availability before continuing." });
    res.status(500).json({ error: serverError(error) });
  }
});

module.exports = router;
