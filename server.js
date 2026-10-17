const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const fs = require("fs");
const ExcelJS = require("exceljs");
const cookieParser = require("cookie-parser");
const MulterError = require("multer").MulterError;

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const NODE_ENV = process.env.NODE_ENV || "development";

if (!JWT_SECRET) {
  console.error("\n❌ Missing required environment variable(s): JWT_SECRET");
  console.error(
    "Set JWT_SECRET in your hosting dashboard or in a .env file for local development.\n",
  );
  process.exit(1);
}

if (NODE_ENV === "production") {
  const requiredProductionEnv = [
    "MONGO_URI",
    "PLATFORM_ROOT_DOMAIN",
    "RESEND_API_KEY",
    "PLATFORM_EMAIL_FROM",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "PLATFORM_ADMIN_NAME",
    "PLATFORM_ADMIN_EMAIL",
    "PLATFORM_ADMIN_PASSWORD",
  ];
  const missing = requiredProductionEnv.filter((name) => !process.env[name]);
  if (JWT_SECRET.length < 32)
    missing.push("JWT_SECRET (minimum 32 characters)");
  if (missing.length) {
    console.error(`Missing production configuration: ${missing.join(", ")}`);
    process.exit(1);
  }
}

const app = express();
// Behind Render's proxy, trust the first hop so req.ip (used by rate
// limiting) reflects the real client instead of the proxy address.
if (NODE_ENV === "production") app.set("trust proxy", 1);
const parsedPort = parseInt(process.env.PORT, 10);
// Port 0 is allowed (tests bind a random port); invalid/empty falls back.
const PORT = Number.isInteger(parsedPort) && parsedPort >= 0 ? parsedPort : 3000;

const { createTenantModelProxies } = require("./utils/tenantModels");
const tenantModels = createTenantModelProxies();
const { User, Admin, Settings, Registration, Property, Unit, TenantAccount, TenantApplication } = tenantModels;
const Client = require("./models/Client");
const ensurePlatformOwner = require("./utils/ensurePlatformOwner");
const platformRoutes = require("./routes/platform");
const resolveTenant = require("./utils/tenantContext");
const getReceiptAccessError = require("./utils/receiptAccess");
const upload = require("./multer");
const { rateLimit } = require("./utils/rateLimit");

// Brute-force protection for credential and verification endpoints.
const adminLoginLimiter = rateLimit({
  name: "admin-login",
  windowMs: 15 * 60 * 1000,
  max: 10,
});
const tenantLoginLimiter = rateLimit({
  name: "tenant-login",
  windowMs: 15 * 60 * 1000,
  max: 10,
});

app.use(cookieParser());
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(
  express.json({
    limit: "10mb",
  }),
);
app.use(
  express.urlencoded({
    extended: false,
    limit: "10mb",
  }),
);
// Serve the React build (client/dist) when it exists. Client-side routes
// are handled by the SPA fallback registered below.
const CLIENT_DIST = path.join(__dirname, "client", "dist");
const CLIENT_INDEX = path.join(CLIENT_DIST, "index.html");
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}
app.use(platformRoutes);
app.use(resolveTenant);
function getSession() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}
function getNextSession() {
  const start = Number(getSession().split("/")[0]);
  return `${start + 1}/${start + 2}`;
}

function verifyAdmin(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(403).json({ error: "No token" });
  try {
    const d = jwt.verify(token, JWT_SECRET);
    if (!['admin', 'owner', 'superadmin'].includes(d.role))
      return res.status(403).json({ error: "Not authorized" });
    const tokenClientId = String(d.clientId || "");
    const requestClientId = String(req.tenantClient?._id || "");
    if (tokenClientId !== requestClientId)
      return res
        .status(403)
        .json({ error: "Not authorized for this platform" });
    req.admin = d;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}
function deleteUploadedFile(cloudinaryUrl) {
  if (!cloudinaryUrl) return;

  try {
    const cloudinary = require("cloudinary").v2;

    // Extract public ID from full Cloudinary URL
    // URL format: .../upload/v1234567890/folder/filename.ext
    const uploadIndex = cloudinaryUrl.indexOf("/upload/");
    if (uploadIndex === -1) return;

    // Get everything after /upload/vXXXXXX/
    let publicId = cloudinaryUrl.substring(uploadIndex + 8);

    // Remove version number if present (v1234567890/)
    publicId = publicId.replace(/^v\d+\//, "");

    // Remove file extension
    publicId = publicId.replace(/\.[^/.]+$/, "");

    // Determine resource type — PDFs are stored as raw
    const isPDF = cloudinaryUrl.toLowerCase().includes(".pdf");
    const resourceType = isPDF ? "raw" : "image";

    cloudinary.uploader.destroy(
      publicId,
      { resource_type: resourceType },
      (err, result) => {
        if (err) {
          console.error(
            "Failed to delete from Cloudinary:",
            publicId,
            err.message,
          );
        } else {
          console.log("Deleted from Cloudinary:", publicId, result);
        }
      },
    );
  } catch (e) {
    console.error("deleteUploadedFile error:", e.message);
  }
}

function sanitizeString(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("\0")) return "";
  return trimmed;
}

function sanitizeEmail(value) {
  return sanitizeString(value).toLowerCase();
}

function sanitizePhone(value) {
  return sanitizeString(value).replace(/[^0-9+]/g, "");
}

function sanitizeLocation(value, client) {
  const loc = sanitizeString(value);
  const allowedLocations = client ? client.locations || [] : null;
  if (!loc) return "";
  // A client with no configured locations must not inherit another business's
  // old campus list. The root/legacy workspace uses property records as its
  // source of truth; its forms submit locations loaded from /tenant-config.
  if (!allowedLocations) return loc;
  return allowedLocations.includes(loc) ? loc : "";
}

// Older De-Crown records predate state/LGA fields. Keep those records usable
// without rewriting production data during application startup; new properties
// always use the explicit geography saved by the operations workspace.
function getPropertyGeography(property) {
  return {
    state: property?.state || "",
    lga: property?.lga || "",
  };
}

function sanitizeType(value) {
  const type = sanitizeString(value).toLowerCase();
  return ["tenant", "shop"].includes(type) ? type : "tenant";
}

function sanitizeRole(value) {
  const role = sanitizeString(value).toLowerCase();
  return ["admin", "owner", "superadmin"].includes(role) ? role : "admin";
}

function sanitizeSession(value) {
  return sanitizeString(value);
}

function isValidEmail(value) {
  return /^[\w.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(
    sanitizeEmail(value),
  );
}

function isValidPhone(value) {
  return /^\+?[0-9]{11,15}$/.test(sanitizePhone(value));
}

function isValidName(value) {
  return /^[A-Za-z][A-Za-z\s'.-]{2,49}$/.test(sanitizeString(value));
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Log server errors with detail, but never leak internals to clients in
// production (development keeps the message for local debugging).
function serverError(error) {
  console.error(error);
  return NODE_ENV === "production"
    ? "Server error"
    : error?.message || "Server error";
}

function uploadedFileUrl(file, testName) {
  return file?.secure_url || file?.path || (NODE_ENV === "test" ? `test-upload://${testName}` : null);
}

function verifySuperAdmin(req, res, next) {
  verifyAdmin(req, res, () => {
    if (!['owner', 'superadmin'].includes(req.admin.role))
      return res.status(403).json({ error: "Tenant owner only" });
    next();
  });
}

function verifyTenant(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(403).json({ error: "No token" });
  try {
    const d = jwt.verify(token, JWT_SECRET);
    if (d.type !== "tenant")
      return res.status(403).json({ error: "Not a tenant token" });
    const tokenClientId = String(d.clientId || "");
    const requestClientId = String(req.tenantClient?._id || "");
    if (tokenClientId !== requestClientId)
      return res
        .status(403)
        .json({ error: "Not authorized for this platform" });
    req.tenant = d;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

function verifyTenantAccount(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "Sign in to continue" });
  try {
    const d = jwt.verify(token, JWT_SECRET);
    if (d.type !== "tenant-account") return res.status(403).json({ error: "Not a tenant account session" });
    if (String(d.clientId || "") !== String(req.tenantClient?._id || "")) {
      return res.status(403).json({ error: "Not authorized for this platform" });
    }
    req.tenantAccount = d;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// â”€â”€â”€ Admin Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/admin/login", adminLoginLimiter, async (req, res) => {
  const email = sanitizeEmail(req.body.email);
  const password = sanitizeString(req.body.password);
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  if (!isValidEmail(email))
    return res
      .status(400)
      .json({ error: "Please enter a valid email address" });
  if (password.length < 6)
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await admin.comparePassword(password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        ...(req.tenantClient && { clientId: String(req.tenantClient._id) }),
      },
      JWT_SECRET,
      { expiresIn: "30m" },
    );
    res.json({ token, name: admin.name, role: admin.role });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.get("/admin/list", verifySuperAdmin, async (req, res) => {
  try {
    const admins = await Admin.find({}, "-password").sort({ createdAt: 1 });
    res.json(admins);
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.post("/admin/create", verifySuperAdmin, async (req, res) => {
  try {
    const name = sanitizeString(req.body.name);
    const email = sanitizeEmail(req.body.email);
    const password = sanitizeString(req.body.password);
    const role = sanitizeRole(req.body.role || "admin");
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });
    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ error: "Email already in use" });
    const admin = await new Admin({
      name,
      email,
      password,
      role: role || "admin",
    }).save();
    res.json({ message: "Admin created", id: admin._id });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.delete("/admin/:id", verifySuperAdmin, async (req, res) => {
  try {
    if (req.params.id === req.admin.id)
      return res.status(400).json({ error: "Cannot delete yourself" });
    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: "Admin removed" });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

// â”€â”€â”€ Tenant Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/tenant/account/signup", tenantLoginLimiter, async (req, res) => {
  try {
    const name = sanitizeString(req.body.name);
    const email = sanitizeEmail(req.body.email);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!isValidName(name)) return res.status(400).json({ error: "Enter a valid full name." });
    if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must be between 8 and 128 characters." });
    const existing = await TenantAccount.findOne({ email });
    if (existing) return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    const account = await new TenantAccount({ name, email, passwordHash: await bcrypt.hash(password, 12) }).save();
    const token = jwt.sign({ id: String(account._id), email, name, type: "tenant-account", ...(req.tenantClient && { clientId: String(req.tenantClient._id) }) }, JWT_SECRET, { expiresIn: "24h" });
    res.status(201).json({ token, account: { id: String(account._id), name: account.name, email: account.email } });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    res.status(500).json({ error: serverError(e) });
  }
});

app.post("/tenant/account/login", tenantLoginLimiter, async (req, res) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!isValidEmail(email) || !password) return res.status(400).json({ error: "Enter a valid email and password." });
    const account = await TenantAccount.findOne({ email });
    if (!account || !(await bcrypt.compare(password, account.passwordHash))) return res.status(401).json({ error: "Invalid email or password." });
    const token = jwt.sign({ id: String(account._id), email, name: account.name, type: "tenant-account", ...(req.tenantClient && { clientId: String(req.tenantClient._id) }) }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, account: { id: String(account._id), name: account.name, email: account.email } });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.get("/tenant/account/me", verifyTenantAccount, async (req, res) => {
  try {
    const account = await TenantAccount.findById(req.tenantAccount.id).select("name email createdAt");
    if (!account) return res.status(404).json({ error: "Tenant account not found" });
    res.json({ account, applications: await TenantApplication.find({ tenantAccountId: account._id }).sort({ createdAt: -1 }).select("name email phone location roomNo session status managementNote agreementCopy paymentProof paymentVerifiedAt allocatedAt createdAt") });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.post("/tenant/account/applications", verifyTenantAccount, upload.fields([{ name: "passport", maxCount: 1 }, { name: "idCard", maxCount: 1 }]), async (req, res) => {
  try {
    if (!(await isRegistrationOpen())) return res.status(403).json({ error: "New room applications are currently closed." });
    const account = await TenantAccount.findById(req.tenantAccount.id);
    if (!account) return res.status(401).json({ error: "Sign in to continue" });
    const { phone, guardianName, guardianPhone, matricNumber, level, state, lga, propertyId, unitId, termsAccepted } = req.body;
    if (!isValidPhone(phone) || !isValidName(guardianName) || !isValidPhone(guardianPhone)) return res.status(400).json({ error: "Enter valid phone and guardian details." });
    if (!sanitizeString(matricNumber) || !sanitizeString(level) || !sanitizeString(state) || !sanitizeString(lga)) return res.status(400).json({ error: "Complete your matric number, level, state and local government." });
    if (!(termsAccepted === "true" || termsAccepted === "on" || termsAccepted === "1")) return res.status(400).json({ error: "Please accept the application terms." });
    if (!req.files?.passport?.[0] || !req.files?.idCard?.[0]) return res.status(400).json({ error: "Passport photograph and ID card are required." });
    if (!isValidObjectId(propertyId) || !isValidObjectId(unitId)) return res.status(400).json({ error: "Choose a valid available room." });
    const property = await Property.findOne({ _id: propertyId, status: "active", propertyType: "hostel" });
    const unit = property ? await Unit.findOne({ _id: unitId, propertyId: property._id, status: "available", applicationHoldId: null }) : null;
    if (!property || !unit) return res.status(409).json({ error: "This room is no longer available. Please choose another room." });
    const geography = getPropertyGeography(property);
    if (geography.state !== sanitizeString(state) || geography.lga !== sanitizeString(lga)) return res.status(400).json({ error: "The selected room does not match the chosen location." });
    const passportUrl = uploadedFileUrl(req.files?.passport?.[0], "passport");
    const idCardUrl = uploadedFileUrl(req.files?.idCard?.[0], "id-card");
    if (!passportUrl || !idCardUrl) return res.status(503).json({ error: "Document storage is not configured. Please contact De-Crown management." });
    const application = await new TenantApplication({
      tenantAccountId: account._id, name: account.name, email: account.email,
      phone: sanitizePhone(phone), guardianName: sanitizeString(guardianName), guardianPhone: sanitizePhone(guardianPhone),
      matricNumber: sanitizeString(matricNumber), level: sanitizeString(level), state: geography.state, lga: geography.lga,
      location: property.name, propertyId: property._id, unitId: unit._id, roomNo: unit.label, session: getSession(),
      rentAmount: unit.rentAmount ?? 0,
      passport: passportUrl,
      idCard: idCardUrl,
    }).save();
    res.status(201).json({ message: "Room application submitted. De-Crown will review it and contact you about the physical agreement.", application: { id: application._id, status: application.status } });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.post("/tenant/account/applications/:id/agreement", verifyTenantAccount, upload.single("file"), async (req, res) => {
  try {
    const application = await TenantApplication.findOne({ _id: req.params.id, tenantAccountId: req.tenantAccount.id });
    if (!application) return res.status(404).json({ error: "Application not found" });
    if (application.status !== "agreement_requested") return res.status(403).json({ error: "Management has not requested the signed agreement yet." });
    if (!req.file) return res.status(400).json({ error: "Upload the signed agreement file." });
    application.agreementCopy = uploadedFileUrl(req.file, "agreement");
    if (!application.agreementCopy) return res.status(503).json({ error: "Document storage is not configured. Please contact De-Crown management." });
    application.status = "agreement_submitted";
    await application.save();
    res.json({ message: "Signed agreement uploaded. De-Crown will review it before authorizing payment." });
  } catch (e) { res.status(500).json({ error: serverError(e) }); }
});

app.post("/tenant/account/applications/:id/payment", verifyTenantAccount, upload.single("file"), async (req, res) => {
  try {
    const application = await TenantApplication.findOne({ _id: req.params.id, tenantAccountId: req.tenantAccount.id });
    if (!application) return res.status(404).json({ error: "Application not found" });
    if (application.status !== "payment_unlocked") return res.status(403).json({ error: "Payment is not available until management accepts your signed agreement." });
    if (!req.file) return res.status(400).json({ error: "Upload your payment receipt." });
    application.paymentProof = uploadedFileUrl(req.file, "payment-proof");
    if (!application.paymentProof) return res.status(503).json({ error: "Document storage is not configured. Please contact De-Crown management." });
    application.paymentDate = sanitizeString(req.body.paymentDate) || new Date().toISOString().slice(0, 10);
    application.status = "payment_submitted";
    await application.save();
    res.json({ message: "Payment proof submitted. Your room will not be allocated until De-Crown verifies payment." });
  } catch (e) { res.status(500).json({ error: serverError(e) }); }
});

app.get("/admin/tenant-applications", verifyAdmin, async (_req, res) => {
  try {
    const applications = await TenantApplication.find().sort({ createdAt: -1 }).limit(250).lean();
    res.json(applications);
  } catch (e) { res.status(500).json({ error: serverError(e) }); }
});

app.put("/admin/tenant-applications/:id/status", verifyAdmin, async (req, res) => {
  try {
    const nextStatus = sanitizeString(req.body.status);
    const note = sanitizeString(req.body.managementNote).slice(0, 1000);
    const allowed = {
      under_review: ["agreement_requested", "rejected"],
      agreement_submitted: ["payment_unlocked", "rejected"],
      rejected: ["under_review"],
      payment_unlocked: ["rejected"],
    };
    const application = await TenantApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ error: "Application not found" });
    if (!(allowed[application.status] || []).includes(nextStatus)) return res.status(409).json({ error: `Cannot move application from ${application.status} to ${nextStatus}.` });
    if (nextStatus === "agreement_requested") {
      const unitAvailable = await Unit.findOne({ _id: application.unitId, propertyId: application.propertyId, status: "available", applicationHoldId: null });
      const roomTaken = await User.findOne({ location: application.location, roomNo: application.roomNo, session: application.session });
      if (!unitAvailable || roomTaken) return res.status(409).json({ error: "The requested room is no longer available. Contact the applicant to choose another room." });
    }
    if (nextStatus === "payment_unlocked") {
      const unit = await Unit.findOneAndUpdate(
        { _id: application.unitId, propertyId: application.propertyId, status: "available", $or: [{ applicationHoldId: null }, { applicationHoldId: { $exists: false } }] },
        { $set: { applicationHoldId: application._id } },
        { returnDocument: "after" },
      );
      if (!unit) return res.status(409).json({ error: "This room is no longer available to hold. Contact the applicant before accepting payment." });
    }
    if (nextStatus === "rejected" && application.status === "payment_unlocked") {
      await Unit.updateOne({ _id: application.unitId, applicationHoldId: application._id }, { $set: { applicationHoldId: null } });
    }
    application.status = nextStatus;
    application.managementNote = note;
    await application.save();
    res.json({ message: `Application updated to ${nextStatus}.`, application });
  } catch (e) { res.status(500).json({ error: serverError(e) }); }
});

app.put("/admin/tenant-applications/:id/verify-payment", verifyAdmin, async (req, res) => {
  try {
    const application = await TenantApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ error: "Application not found" });
    if (application.status !== "payment_submitted" || !application.paymentProof || !application.agreementCopy) return res.status(409).json({ error: "A signed agreement and submitted payment proof are required." });
    const unit = await Unit.findOne({ _id: application.unitId, propertyId: application.propertyId, status: "available", applicationHoldId: application._id });
    if (!unit) return res.status(409).json({ error: "The held room could not be verified. Resolve room availability before allocating." });
    const duplicate = await User.findOne({ location: application.location, roomNo: application.roomNo, session: application.session });
    if (duplicate) return res.status(409).json({ error: "This room is already allocated for the selected session." });
    const setting = await Settings.findOne({ location: application.location });
    const occupant = await new User({
      location: application.location, propertyId: application.propertyId, unitId: application.unitId,
      name: application.name, email: application.email, phone: application.phone,
      guardianName: application.guardianName, guardianPhone: application.guardianPhone,
      session: application.session, level: application.level, roomNo: application.roomNo,
      amount: application.rentAmount || setting?.rentAmount || 0, paymentDate: application.paymentDate,
      passport: application.passport, idCard: application.idCard, agreementCopy: application.agreementCopy,
      paymentProof: application.paymentProof, retainPending: false, receiptNumber: await generateReceiptNumber(application.location),
    }).save();
    application.status = "allocated";
    application.paymentVerifiedAt = new Date();
    application.allocatedAt = new Date();
    await application.save();
    unit.status = "inactive";
    unit.applicationHoldId = null;
    await unit.save();
    res.json({ message: "Payment verified and room allocated.", tenantId: occupant._id, application });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "This room was allocated by another request. Review availability before continuing." });
    res.status(500).json({ error: serverError(e) });
  }
});

app.post("/tenant/login", tenantLoginLimiter, async (req, res) => {
  const email = sanitizeEmail(req.body.email);
  const phone = sanitizePhone(req.body.phone);
  if (!email || !phone)
    return res.status(400).json({ error: "Email and phone required" });
  if (!isValidEmail(email))
    return res
      .status(400)
      .json({ error: "Please enter a valid email address" });
  if (!isValidPhone(phone))
    return res.status(400).json({ error: "Please enter a valid phone number" });
  try {
    const user = await User.findOne({
      email,
      phone,
    }).sort({ createdAt: -1 });
    if (!user)
      return res
        .status(401)
        .json({ error: "No record found. Check your email and phone number." });
    if (user.status === "revoked")
      return res.status(403).json({
        error:
          "Your access has been revoked by management" +
          (user.revokeReason ? `: ${user.revokeReason}` : "."),
      });
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        type: "tenant",
        ...(req.tenantClient && { clientId: String(req.tenantClient._id) }),
      },
      JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.json({
      token,
      name: user.name,
      location: user.location,
      roomNo: user.roomNo,
      session: user.session,
    });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.get("/tenant/me", verifyTenant, async (req, res) => {
  try {
    const user = await User.findById(req.tenant.id);
    if (!user) return res.status(404).json({ error: "Profile not found" });
    if (user.status === "revoked")
      return res.status(403).json({
        error:
          "Your access has been revoked by management" +
          (user.revokeReason ? `: ${user.revokeReason}` : "."),
        revoked: true,
        reason: user.revokeReason || "",
      });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

// FIX: was missing â€” all sessions for this tenant (by email)
app.get("/tenant/history", verifyTenant, async (req, res) => {
  try {
    const current = await User.findById(req.tenant.id);
    if (current && current.status === "revoked")
      return res.status(403).json({
        error:
          "Your access has been revoked by management" +
          (current.revokeReason ? `: ${current.revokeReason}` : "."),
      });
    const records = await User.find({ email: req.tenant.email })
      .sort({ createdAt: -1 })
      .select(
        "session roomNo amount paymentDate paymentProof agreementCopy retainPending disapproved disapprovalReason renewedFrom _id type level",
      );
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.post("/tenant/retain", verifyTenant, async (req, res) => {
  try {
    if (!(await isRegistrationOpen(getNextSession())))
      return res.status(403).json({
        error: "Room retention is currently closed for the next session.",
      });

    const orig = await User.findById(req.tenant.id);
    if (!orig) return res.status(404).json({ error: "Profile not found" });
    if (orig.status === "revoked")
      return res.status(403).json({
        error:
          "Your access has been revoked by management" +
          (orig.revokeReason ? `: ${orig.revokeReason}` : "."),
      });

    const nextSess = getNextSession();
    const existing = await User.findOne({
      email: orig.email,
      session: nextSess,
    });
    if (existing)
      return res
        .status(400)
        .json({ error: `Already retained for ${nextSess}` });

    const roomTaken = await User.findOne({
      location: orig.location,
      roomNo: orig.roomNo,
      session: nextSess,
    });
    if (roomTaken)
      return res
        .status(400)
        .json({ error: `Room ${orig.roomNo} already claimed for ${nextSess}` });

    const setting = await Settings.findOne({ location: orig.location });
    const renewed = await new User({
      location: orig.location,
      propertyId: orig.propertyId,
      unitId: orig.unitId,
      type: orig.type || "tenant",
      name: orig.name,
      email: orig.email,
      phone: orig.phone,
      guardianName: orig.guardianName,
      guardianPhone: orig.guardianPhone,
      session: nextSess,
      level: orig.level,
      roomNo: orig.roomNo,
      amount: setting?.rentAmount ?? orig.amount,
      paymentDate: null,
      passport: orig.passport,
      paymentProof: null,
      renewedFrom: orig._id,
      retainPending: true,
    }).save();

    res.json({
      message: `Room ${orig.roomNo} retained for ${nextSess}. Upload your payment receipt below.`,
      session: nextSess,
      id: renewed._id,
    });
  } catch (e) {
    if (e.code === 11000)
      return res
        .status(400)
        .json({ error: "Already retained for next session" });
    res.status(500).json({ error: serverError(e) });
  }
});

// FIX: was missing â€” tenant uploads payment proof for pending retention
app.post(
  "/tenant/upload-retain-proof",
  verifyTenant,
  upload.single("paymentProof"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const current = await User.findById(req.tenant.id);
      if (current && current.status === "revoked")
        return res.status(403).json({
          error:
            "Your access has been revoked by management" +
            (current.revokeReason ? `: ${current.revokeReason}` : "."),
        });

      const nextSess = getNextSession();
      const record = await User.findOne({
        email: req.tenant.email,
        session: nextSess,
        retainPending: true,
      });
      if (!record)
        return res.status(404).json({
          error: "No pending retention found. Request retention first.",
        });

      record.paymentProof = req.file.secure_url || req.file.path || null;
      await record.save();
      res.json({ message: "Receipt uploaded. Awaiting admin approval." });
    } catch (e) {
      res.status(500).json({ error: serverError(e) });
    }
  },
);

// Grant re-upload access with 24hr window
app.put("/admin/grant-reupload/:id", verifyAdmin, async (req, res) => {
  try {
    const { passport, idCard, proof, agreementCopy } = req.body;

    if (!passport && !idCard && !proof && !agreementCopy)
      return res.status(400).json({ error: "Select at least one document" });

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(req.params.id, {
      canReuploadPassport: !!passport,
      canReuploadIdCard: !!idCard,
      canReuploadProof: !!proof,
      canReuploadAgreement: !!agreementCopy,
      reuploadExpiresAt: expires,
    });

    res.json({ message: "Re-upload access granted for 24 hours" });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});
// Tenant re-uploads a specific document (admin must have granted access)
app.put(
  "/tenant/reupload",
  verifyTenant,
  upload.single("file"),
  async (req, res) => {
    try {
      const { field } = req.body;

      if (
        !["passport", "idCard", "paymentProof", "agreementCopy"].includes(field)
      )
        return res.status(400).json({ error: "Invalid field" });

      const user = await User.findById(req.tenant.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.status === "revoked")
        return res.status(403).json({
          error:
            "Your access has been revoked by management" +
            (user.revokeReason ? `: ${user.revokeReason}` : "."),
        });

      // Check which flag corresponds to this field
      const flagMap = {
        passport: "canReuploadPassport",
        idCard: "canReuploadIdCard",
        paymentProof: "canReuploadProof",
        agreementCopy: "canReuploadAgreement",
      };
      const flag = flagMap[field];

      if (!user[flag])
        return res.status(403).json({
          error: "Re-upload not permitted for this document",
        });

      // Check 24hr window
      if (!user.reuploadExpiresAt || new Date() > user.reuploadExpiresAt)
        return res.status(403).json({
          error:
            "Re-upload window has expired. Ask admin to grant access again.",
        });

      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      // Delete old file from Cloudinary
      if (user[field]) deleteUploadedFile(user[field]);

      // Save new file
      const newUrl = req.file.secure_url || req.file.path;
      user[field] = newUrl;

      // Reset the flag
      user[flag] = false;

      // Clear expiry if all flags are now false
      if (
        !user.canReuploadPassport &&
        !user.canReuploadIdCard &&
        !user.canReuploadProof &&
        !user.canReuploadAgreement
      ) {
        user.reuploadExpiresAt = null;
      }

      // Log the change
      if (!user.changeLog) user.changeLog = [];
      user.changeLog.push({
        field: field,
        changedAt: new Date(),
        note: field + " updated by tenant",
      });

      await user.save();
      res.json({ message: "Document updated successfully" });
    } catch (e) {
      res.status(500).json({ error: serverError(e) });
    }
  },
);

async function getRegistrationState(session = getSession()) {
  try {
    return await Registration.findOne({ session });
  } catch (e) {
    return null;
  }
}

async function isRegistrationOpen(session = getSession()) {
  const state = await getRegistrationState(session);
  return state ? state.open : true;
}

// ----- Public Routes -----
app.get("/current-session", async (req, res) => {
  const currentState = await getRegistrationState(getSession());
  const nextState = await getRegistrationState(getNextSession());
  const registrationOpen = currentState
    ? currentState.open
    : nextState
      ? nextState.open
      : true;

  res.json({
    session: getSession(),
    next: getNextSession(),
    registrationOpen,
  });
});

app.get("/tenant-config", async (req, res) => {
  try {
    const storedProperties = await Property.find().sort({ name: 1 });
    let properties = storedProperties.filter(
      (property) => property.status === "active",
    );
    const locations = await Promise.all(
      properties.map(async (property) => {
        const units = property._id
          ? await Unit.find({
              propertyId: property._id,
              status: { $ne: "inactive" },
            }).sort({ unitCode: 1 })
          : [];
        const occupied = await User.find({
          location: property.name,
          session: getSession(),
        }).select("unitId roomNo");
        const occupiedIds = new Set(
          occupied.map((user) => String(user.unitId || "")),
        );
        const occupiedLabels = new Set(occupied.map((user) => user.roomNo));
        const settings = await Settings.findOne({ location: property.name });
        return {
          id: property._id,
          name: property.name,
          ...getPropertyGeography(property),
          propertyType: property.propertyType,
          status: property.status,
          address: property.address,
          rentAmount: settings?.rentAmount ?? 0,
          units: units.map((unit) => ({
            id: unit._id,
            label: unit.label,
            unitType: unit.unitType,
            status:
              unit.status === "available" &&
              (unit.applicationHoldId || occupiedIds.has(String(unit._id)) ||
                occupiedLabels.has(unit.label))
                ? "occupied"
                : unit.status,
            rentAmount: unit.rentAmount,
          })),
        };
      }),
    );
    res.json({
      isTenant: Boolean(req.tenantClient),
      businessName: req.tenantClient?.businessName || "De-Crown Cottage",
      branding: req.tenantClient?.branding || {},
      bankDetails: req.tenantClient?.bankDetails || {},
      phone: req.tenantClient?.phone || "09036388983",
      email: req.tenantClient?.email || "decrown@gmail.com",
      locations,
    });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.get("/current-amount", async (req, res) => {
  try {
    const { location, unit: unitLabel } = req.query;
    const requestedLocation = sanitizeString(location);
    if (!requestedLocation)
      return res.status(400).json({ error: "location required" });
    // Property names are managed by the agency. Do not limit public room/rent
    // lookups to the legacy campus list; new hostels must work immediately.
    const property = await Property.findOne({
      name: requestedLocation,
      status: "active",
    });
    if (!property)
      return res.status(404).json({ error: "Property not found" });
    const safeLocation = property.name;
    const s = await Settings.findOne({ location: safeLocation });
    if (!s) return res.status(404).json({ error: "Settings not found" });
    const unit = unitLabel
      ? await Unit.findOne({
          propertyId: property._id,
          label: sanitizeString(unitLabel),
          status: "available",
        })
      : null;
    res.json({ amount: unit?.rentAmount ?? s.rentAmount });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

// FIX: /user/:id is now PUBLIC so receipt page works without admin token
app.get("/user/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: "Not found" });
    const receiptAccessError = getReceiptAccessError(u);
    if (receiptAccessError)
      return res.status(403).json({ error: receiptAccessError });
    // Receipt is public, but a revoked tenant who sends their token must not
    // be able to view it (the portal blocks revoked logins; this is defense
    // in depth for sessions that are still active).
    const bearer = (req.headers.authorization || "")
      .replace("Bearer ", "")
      .trim();
    if (bearer) {
      try {
        const d = jwt.verify(bearer, JWT_SECRET);
        if (d.type === "tenant") {
          const t = await User.findById(d.id);
          if (t && t.status === "revoked")
            return res.status(403).json({
              error:
                "Your access has been revoked by management" +
                (t.revokeReason ? `: ${t.revokeReason}` : "."),
            });
        }
      } catch {
        /* invalid/expired token — receipt stays public */
      }
    }
    res.json({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      location: u.location,
      session: u.session,
      level: u.level,
      roomNo: u.roomNo,
      amount: u.amount,
      paymentDate: u.paymentDate,
      passport: u.passport,
      paymentProof: u.paymentProof,
      retainPending: u.retainPending,
      disapproved: u.disapproved,
      disapprovalReason: u.disapprovalReason,
      renewedFrom: u.renewedFrom,
      type: u.type,
      receiptNumber: u.receiptNumber,
      createdAt: u.createdAt,
    });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

async function generateReceiptNumber(location) {
  const prefix =
    String(location || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 3)
      .toUpperCase() || "RCP";
  const year = new Date().getFullYear();
  // Monotonic sequence per location+year. The old countDocuments() approach
  // regressed after record deletions and collided under concurrency; take
  // the highest number ever issued instead. (Two truly simultaneous submits
  // could still tie — a unique index on receiptNumber is the follow-up once
  // legacy data is verified clean.)
  const issuedPattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const [latest] = await User.aggregate([
    { $match: { location, receiptNumber: { $regex: issuedPattern } } },
    // $regexFind: captures[0] is the first (only) group — the sequence digits
    { $project: { found: { $regexFind: { input: "$receiptNumber", regex: issuedPattern } } } },
    { $project: { sequence: { $toInt: { $arrayElemAt: ["$found.captures", 0] } } } },
    { $sort: { sequence: -1 } },
    { $limit: 1 },
  ]);
  const num = String((latest?.sequence || 0) + 1).padStart(4, "0");
  return `${prefix}-${year}-${num}`;
}
app.post(
  "/submit",
  upload.fields([
    { name: "passport" },
    { name: "idCard" },
    { name: "paymentProof" },
    { name: "agreementCopy" },
  ]),
  async (req, res) => {
    try {
      if (!(await isRegistrationOpen()))
        return res
          .status(403)
          .json({ error: "New registration is currently closed." });

      const {
        location,
        name,
        email,
        phone,
        guardianName,
        guardianPhone,
        level,
        state,
        lga,
        roomNo,
        paymentDate,
        type = "tenant",
        termsAccepted,
      } = req.body;

      if (!isValidName(name) || !isValidName(guardianName || "")) {
        return res
          .status(400)
          .json({ error: "Please enter valid name details." });
      }
      if (!isValidEmail(email)) {
        return res
          .status(400)
          .json({ error: "Please enter a valid email address." });
      }
      if (!isValidPhone(phone) || !isValidPhone(guardianPhone || "")) {
        return res
          .status(400)
          .json({ error: "Please enter valid 11-digit phone numbers." });
      }

      if (
        !req.files?.passport?.[0] ||
        !req.files?.idCard?.[0] ||
        !req.files?.paymentProof?.[0]
      ) {
        return res.status(400).json({
          error: "Passport, ID card, and payment proof are required.",
        });
      }

      const acceptedTerms =
        termsAccepted === true ||
        termsAccepted === "true" ||
        termsAccepted === "on" ||
        termsAccepted === 1 ||
        termsAccepted === "1";
      if (!acceptedTerms) {
        return res
          .status(400)
          .json({ error: "You must accept the terms and conditions." });
      }

      const requestedLocation = sanitizeString(location);
      const safeState = sanitizeString(state);
      const safeLga = sanitizeString(lga);
      const safeName = sanitizeString(name);
      const safeEmail = sanitizeEmail(email);
      const safePhone = sanitizePhone(phone);
      const safeGuardianName = sanitizeString(guardianName);
      const safeGuardianPhone = sanitizePhone(guardianPhone);
      const safeLevel = sanitizeString(level);
      const safeRoomNo = sanitizeString(roomNo);
      const safeType = sanitizeType(type);
      const safePaymentDate = sanitizeString(paymentDate);

      if (!requestedLocation)
        return res.status(400).json({ error: "Invalid location" });
      if (!safeState || !safeLga)
        return res.status(400).json({ error: "Select a state and local government area" });

      const session = getSession();
      const property = await Property.findOne({
        name: requestedLocation,
        status: "active",
      });
      if (!property)
        return res.status(400).json({ error: "Select an active hostel" });
      const safeLocation = property.name;
      const setting = await Settings.findOne({ location: safeLocation });
      if (!setting)
        return res.status(400).json({ error: "Location is not configured" });
      const geography = getPropertyGeography(property);
      // Match the submitted location against the saved property, while still
      // accepting the known legacy campuses whose geography is inferred above.
      if (
        property &&
        (geography.state !== safeState || geography.lga !== safeLga)
      )
        return res.status(400).json({ error: "Property does not match the selected location" });
      const unit = property
        ? await Unit.findOne({
            propertyId: property._id,
            label: safeRoomNo,
            status: "available",
            applicationHoldId: null,
          })
        : null;
      if (!unit)
        return res.status(400).json({ error: "That unit is unavailable" });
      const roomTaken = await User.findOne({
        location: safeLocation,
        roomNo: safeRoomNo,
        session,
      });
      if (roomTaken)
        return res
          .status(400)
          .json({ error: "Room already occupied for this session" });

      await new User({
        location: safeLocation,
        propertyId: property._id,
        unitId: unit._id,
        type: safeType,
        name: safeName,
        email: safeEmail,
        phone: safePhone,
        guardianName: safeGuardianName,
        guardianPhone: safeGuardianPhone,
        session,
        level: safeLevel,
        roomNo: safeRoomNo,
        amount: unit.rentAmount ?? setting.rentAmount,
        paymentDate: safePaymentDate,
        passport:
          req.files?.passport?.[0]?.secure_url ||
          req.files?.passport?.[0]?.path ||
          null,
        idCard:
          req.files?.idCard?.[0]?.secure_url ||
          req.files?.idCard?.[0]?.path ||
          null,
        paymentProof:
          req.files?.paymentProof?.[0]?.secure_url ||
          req.files?.paymentProof?.[0]?.path ||
          null,
        agreementCopy:
          req.files?.agreementCopy?.[0]?.secure_url ||
          req.files?.agreementCopy?.[0]?.path ||
          null,
        retainPending: true,
        receiptNumber: await generateReceiptNumber(safeLocation),
      }).save();

      res.json({
        message:
          "Application submitted successfully. Please wait for admin review.",
      });
    } catch (err) {
      if (err.code === 11000) {
        const k = Object.keys(err.keyValue || {})[0];
        return res.status(400).json({
          error:
            k === "email"
              ? "Email already registered"
              : "Phone already registered",
        });
      }
      res.status(500).json({ error: serverError(err) });
    }
  },
);

// â”€â”€â”€ Admin Data Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FIX: supports ?email= so drawer can fetch all sessions for one tenant
app.get("/users", verifyAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.location)
      filter.location = sanitizeLocation(req.query.location, req.tenantClient);
    if (req.query.session) filter.session = sanitizeSession(req.query.session);
    if (req.query.type) filter.type = sanitizeType(req.query.type);
    if (req.query.email) filter.email = sanitizeEmail(req.query.email);
    const users = await User.find(filter);
    users.sort(
      (a, b) =>
        parseInt(a.roomNo?.replace(/\D/g, "") || 0) -
        parseInt(b.roomNo?.replace(/\D/g, "") || 0),
    );
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.get("/admin/get-amounts", verifyAdmin, async (req, res) => {
  try {
    const settings = await Settings.find();
    const state = await getRegistrationState();
    const r = {
      // Default must match isRegistrationOpen()/current-session (open unless
      // explicitly closed) — this used to report "closed" while the public
      // registration form accepted submissions.
      registrationOpen: state ? state.open : true,
      locations: settings.map((setting) => ({
        name: setting.location,
        rentAmount: setting.rentAmount,
      roomCount: setting.roomCount ?? 0,
      })),
    };
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.get("/admin/properties", verifyAdmin, async (req, res) => {
  try {
    const properties = await Property.find().sort({ name: 1 });
    const result = await Promise.all(
      properties.map(async (property) => ({
        ...property.toObject(),
        settings: await Settings.findOne({ location: property.name }),
        units: await Unit.find({ propertyId: property._id }).sort({
          unitCode: 1,
        }),
      })),
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: serverError(error) });
  }
});

app.post("/admin/properties", verifyAdmin, async (req, res) => {
  try {
    const name = sanitizeString(req.body.name);
    const state = sanitizeString(req.body.state);
    const lga = sanitizeString(req.body.lga);
    const propertyType = sanitizeString(
      req.body.propertyType || "hostel",
    ).toLowerCase();
    const address = sanitizeString(req.body.address);
    const rentAmount = Number(req.body.rentAmount ?? 0);
    const supportedTypes = [
      "hostel",
      "apartment",
      "house",
      "commercial",
      "mixed",
      "other",
    ];
    if (
      !name ||
      name.length > 100 ||
      !state ||
      state.length > 60 ||
      !lga ||
      lga.length > 80 ||
      !supportedTypes.includes(propertyType) ||
      !Number.isFinite(rentAmount) ||
      rentAmount < 0
    ) {
      return res.status(400).json({ error: "Invalid property details" });
    }
    if (await Property.findOne({ name }))
      return res.status(409).json({ error: "Property already exists" });

    const property = await Property.create({ name, state, lga, propertyType, address });
    await Settings.create({ location: name, rentAmount, roomCount: 0 });
    if (req.tenantClient) {
      await Client.updateOne(
        { _id: req.tenantClient._id },
        { $addToSet: { locations: name } },
      );
    }
    res.status(201).json({ ...property.toObject(), units: [] });
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ error: "Property already exists" });
    res.status(500).json({ error: serverError(error) });
  }
});

app.put("/admin/properties/:id", verifyAdmin, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ error: "Invalid property ID" });
    const updates = {};
    if (req.body.address != null)
      updates.address = sanitizeString(req.body.address);
    for (const field of ["state", "lga"]) {
      if (req.body[field] != null) {
        const value = sanitizeString(req.body[field]);
        if (!value || value.length > (field === "state" ? 60 : 80))
          return res.status(400).json({ error: `Invalid property ${field}` });
        updates[field] = value;
      }
    }
    if (req.body.propertyType != null) {
      const type = sanitizeString(req.body.propertyType).toLowerCase();
      if (
        ![
          "hostel",
          "apartment",
          "house",
          "commercial",
          "mixed",
          "other",
        ].includes(type)
      )
        return res.status(400).json({ error: "Invalid property type" });
      updates.propertyType = type;
    }
    if (req.body.status != null) {
      if (!["active", "archived"].includes(req.body.status))
        return res.status(400).json({ error: "Invalid property status" });
      updates.status = req.body.status;
    }
    const property = await Property.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: serverError(error) });
  }
});

app.post("/admin/properties/:id/units", verifyAdmin, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ error: "Invalid property ID" });
    const property = await Property.findOne({
      _id: req.params.id,
      status: "active",
    });
    if (!property) return res.status(404).json({ error: "Property not found" });
    const unitCode = sanitizeString(req.body.unitCode);
    const label = sanitizeString(req.body.label);
    const unitType = sanitizeString(req.body.unitType || "room").toLowerCase();
    const rentAmount =
      req.body.rentAmount == null || req.body.rentAmount === ""
        ? null
        : Number(req.body.rentAmount);
    if (!unitCode || !label || unitCode.length > 60 || label.length > 100)
      return res
        .status(400)
        .json({ error: "Unit code and label are required" });
    if (
      !["room", "apartment", "house", "shop", "office", "other"].includes(
        unitType,
      )
    )
      return res.status(400).json({ error: "Invalid unit type" });
    if (rentAmount != null && (!Number.isFinite(rentAmount) || rentAmount < 0))
      return res.status(400).json({ error: "Invalid unit rent" });
    const unit = await Unit.create({
      propertyId: property._id,
      location: property.name,
      unitCode,
      label,
      unitType,
      rentAmount,
    });
    res.status(201).json(unit);
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ error: "Unit code already exists for this property" });
    res.status(500).json({ error: serverError(error) });
  }
});

app.put(
  "/admin/properties/:id/units/:unitId",
  verifyAdmin,
  async (req, res) => {
    try {
      if (
        !isValidObjectId(req.params.id) ||
        !isValidObjectId(req.params.unitId)
      )
        return res.status(400).json({ error: "Invalid property or unit ID" });
      const unit = await Unit.findOne({
        _id: req.params.unitId,
        propertyId: req.params.id,
      });
      if (!unit) return res.status(404).json({ error: "Unit not found" });
      for (const field of ["unitCode", "label"]) {
        if (req.body[field] != null) {
          const value = sanitizeString(req.body[field]);
          if (!value || value.length > (field === "label" ? 100 : 60))
            return res.status(400).json({ error: `Invalid ${field}` });
          unit[field] = value;
        }
      }
      if (req.body.unitType != null) unit.unitType = req.body.unitType;
      if (req.body.status != null) unit.status = req.body.status;
      if (req.body.rentAmount != null)
        unit.rentAmount = Number(req.body.rentAmount);
      await unit.save();
      res.json(unit);
    } catch (error) {
      if (error.code === 11000)
        return res
          .status(409)
          .json({ error: "Unit code already exists for this property" });
      res.status(400).json({ error: serverError(error) });
    }
  },
);

app.delete(
  "/admin/properties/:id/units/:unitId",
  verifyAdmin,
  async (req, res) => {
    try {
      if (
        !isValidObjectId(req.params.id) ||
        !isValidObjectId(req.params.unitId)
      )
        return res.status(400).json({ error: "Invalid property or unit ID" });
      const unit = await Unit.findOne({
        _id: req.params.unitId,
        propertyId: req.params.id,
      });
      if (!unit) return res.status(404).json({ error: "Unit not found" });
      unit.status = "inactive";
      await unit.save();
      res.json({ message: "Unit archived" });
    } catch (error) {
      res.status(500).json({ error: serverError(error) });
    }
  },
);

app.put("/admin/set-registration", verifyAdmin, async (req, res) => {
  try {
    const open = req.body.open;
    const session = sanitizeSession(req.body.session) || getSession();
    if (typeof open !== "boolean")
      return res.status(400).json({ error: "Invalid registration state" });

    const state = await Registration.findOneAndUpdate(
      { session },
      { session, open },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({
      message: "Registration state updated",
      registrationOpen: state.open,
      session: state.session,
    });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.put("/admin/set-amount", verifyAdmin, async (req, res) => {
  try {
    if (Array.isArray(req.body.locations)) {
      for (const item of req.body.locations) {
        const location = sanitizeLocation(item.name, req.tenantClient);
        const rentAmount = Number(item.rentAmount);
        const updates = { rentAmount };
        if (item.roomCount != null) {
          const roomCount = Number(item.roomCount);
          if (
            !Number.isInteger(roomCount) ||
            roomCount < 0 ||
            roomCount > 10000
          )
            return res.status(400).json({ error: "Invalid room count" });
          updates.roomCount = roomCount;
        }
        if (!location || !Number.isFinite(rentAmount) || rentAmount < 0) {
          return res.status(400).json({ error: "Invalid location settings" });
        }
        await Settings.findOneAndUpdate({ location }, updates, {
          upsert: true,
          new: true,
          runValidators: true,
        });
      }
    }
    res.json({ message: "Updated" });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.post("/renew/:id", verifyAdmin, async (req, res) => {
  try {
    const orig = await User.findById(req.params.id);
    if (!orig) return res.status(404).json({ error: "Tenant not found" });

    const nextSess = getNextSession();
    const taken = await User.findOne({
      location: orig.location,
      roomNo: orig.roomNo,
      session: nextSess,
    });
    if (taken)
      return res
        .status(400)
        .json({ error: `Room ${orig.roomNo} already booked for ${nextSess}` });

    const setting = await Settings.findOne({ location: orig.location });
    await new User({
      location: orig.location,
      propertyId: orig.propertyId,
      unitId: orig.unitId,
      type: orig.type || "tenant",
      name: orig.name,
      email: req.body.email || orig.email,
      phone: req.body.phone || orig.phone,
      guardianName: orig.guardianName,
      guardianPhone: orig.guardianPhone,
      session: nextSess,
      level: req.body.level || orig.level,
      roomNo: orig.roomNo,
      amount: setting?.rentAmount ?? orig.amount,
      paymentDate: req.body.paymentDate || null,
      passport: orig.passport,
      paymentProof: null,
      renewedFrom: orig._id,
      retainPending: true,
    }).save();

    res.json({
      message: `Renewal submitted for ${nextSess} and is pending admin approval.`,
    });
  } catch (e) {
    if (e.code === 11000)
      return res
        .status(400)
        .json({ error: "Already renewed for next session" });
    res.status(500).json({ error: serverError(e) });
  }
});

app.put("/approve-retain/:id", verifyAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      retainPending: false,
      paymentDate:
        req.body.paymentDate || new Date().toISOString().slice(0, 10),
      ...(req.body.paymentProof && { paymentProof: req.body.paymentProof }),
    });
    res.json({ message: "Tenant approved" });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.put("/disapprove/:id", verifyAdmin, async (req, res) => {
  try {
    const { reason, note } = req.body;
    await User.findByIdAndUpdate(req.params.id, {
      retainPending: false,
      disapproved: true,
      disapprovalReason: reason || "Not specified",
      disapprovalNote: note || "",
    });
    res.json({ message: "Application rejected" });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.delete("/users/delete-bulk", verifyAdmin, async (req, res) => {
  try {
    const { ids, adminPassword } = req.body;
    if (!Array.isArray(ids) || !ids.every(isValidObjectId))
      return res.status(400).json({ error: "Invalid delete IDs" });
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(403).json({ error: "Admin not found" });

    const valid = await admin.comparePassword(sanitizeString(adminPassword));
    if (!valid) return res.status(403).json({ error: "Incorrect password" });
    const users = await User.find({ _id: { $in: ids } });
    for (const u of users) {
      deleteUploadedFile(u.passport);
      deleteUploadedFile(u.idCard);
      deleteUploadedFile(u.paymentProof);
    }
    await User.deleteMany({ _id: { $in: ids } });
    res.json({ message: `${ids.length} record(s) deleted` });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/export-users", verifyAdmin, async (req, res) => {
  try {
    const users = await User.find();
    const locations = await Settings.find().distinct("location");
    const wb = new ExcelJS.Workbook();
    for (const loc of locations) {
      for (const type of ["tenant", "shop"]) {
        const ws = wb.addWorksheet(`${loc} ${type}s`);
        ws.columns = [
          { header: "Name", key: "name", width: 25 },
          { header: "Email", key: "email", width: 28 },
          { header: "Phone", key: "phone", width: 15 },
          { header: "Room/Unit", key: "roomNo", width: 12 },
          { header: "Session", key: "session", width: 12 },
          { header: "Level", key: "level", width: 10 },
          { header: "Amount", key: "amount", width: 14 },
          { header: "Date", key: "paymentDate", width: 16 },
          { header: "Pending", key: "pending", width: 10 },
        ];
        const hr = ws.getRow(1);
        hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
        hr.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1a3c5e" },
        };
        let total = 0;
        users
          .filter((u) => u.location === loc && (u.type || "tenant") === type)
          .forEach((u) => {
            ws.addRow({
              name: u.name,
              email: u.email,
              phone: u.phone,
              roomNo: u.roomNo,
              session: u.session,
              level: u.level,
              amount: u.amount || 0,
              paymentDate: u.paymentDate
                ? new Date(u.paymentDate).toLocaleDateString("en-NG")
                : "N/A",
              pending: u.retainPending ? "Yes" : "No",
            });
            total += u.amount || 0;
          });
        ws.addRow([]);
        ws.addRow({ name: "TOTAL", amount: total }).font = { bold: true };
      }
    }
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${req.tenantClient?.subdomain || "decrown"}-${Date.now()}.xlsx`,
    );
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

// ── Revoke / Reinstate tenant ────────────────────────────────────────────────
app.put("/revoke/:id", verifyAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      status: "revoked",
      revokeReason: req.body.reason || "Not specified",
      revokeNote: req.body.note || "",
      revokedAt: new Date(),
    });
    res.json({ message: "Tenant revoked" });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.put("/reinstate/:id", verifyAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      status: "active",
      revokeReason: null,
      revokeNote: null,
      revokedAt: null,
    });
    res.json({ message: "Tenant reinstated" });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

// ── Get single user for editing ──────────────────────────────────────────────
app.get("/admin/user/:id", verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

// ── Update user information ──────────────────────────────────────────────────
app.put("/admin/user/:id", verifyAdmin, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      guardianName,
      guardianPhone,
      location,
      type,
      level,
      roomNo,
      session,
      amount,
      paymentDate,
    } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Sanitize inputs
    if (name) user.name = sanitizeString(name);
    if (email) user.email = sanitizeEmail(email);
    if (phone) user.phone = sanitizeString(phone);
    if (guardianName) user.guardianName = sanitizeString(guardianName);
    if (guardianPhone) user.guardianPhone = sanitizeString(guardianPhone);
    if (location) user.location = sanitizeLocation(location, req.tenantClient);
    if (type) user.type = type;
    if (level) user.level = sanitizeString(level);
    if (roomNo) user.roomNo = sanitizeString(roomNo);
    if (session) user.session = sanitizeString(session);
    if (amount != null) user.amount = Number(amount);
    if (paymentDate) user.paymentDate = sanitizeString(paymentDate);

    if (location || roomNo) {
      const property = await Property.findOne({
        name: user.location,
        status: "active",
      });
      const unit = property
        ? await Unit.findOne({
            propertyId: property._id,
            label: user.roomNo,
            status: { $ne: "inactive" },
          })
        : null;
      if (!property || !unit)
        return res
          .status(400)
          .json({ error: "Select a valid property and unit" });
      const assignmentChanged =
        user.propertyId?.toString() !== property._id.toString() ||
        user.unitId?.toString() !== unit._id.toString();
      if (assignmentChanged) {
        if (unit.status !== "available")
          return res.status(400).json({ error: "That unit is unavailable" });
        const occupied = await User.findOne({
          _id: { $ne: user._id },
          location: user.location,
          roomNo: user.roomNo,
          session: user.session,
        });
        if (occupied)
          return res
            .status(409)
            .json({ error: "That unit is assigned for this session" });
      }
      user.propertyId = property._id;
      user.unitId = unit._id;
    }

    await user.save();
    res.json({ message: "User updated successfully", user });
  } catch (e) {
    res.status(500).json({ error: serverError(e) });
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const tooLarge =
    error instanceof MulterError && error.code === "LIMIT_FILE_SIZE";
  const status = tooLarge ? 413 : 400;
  res.status(status).json({
    error: tooLarge ? "Uploaded file exceeds the 5MB limit" : error.message,
  });
});

async function seed() {
  await ensurePlatformOwner();
}

// ── SPA fallback ─────────────────────────────────────────────────────────────
// Serve the React app for client-side routes (/login, /admin, /portal, …).
// Registered last so it only catches GETs that no API route matched.
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (!fs.existsSync(CLIENT_INDEX)) return next();
  res.sendFile(CLIENT_INDEX);
});

async function connectDatabase() {
  const targetUri = MONGO_URI || "mongodb://127.0.0.1:27017/receipt-test";

  try {
    await mongoose.connect(targetUri);
    return targetUri;
  } catch (error) {
    const localDbUnavailable =
      !MONGO_URI ||
      /127\.0\.0\.1|localhost/.test(targetUri) ||
      /ECONNREFUSED|failed to connect|could not connect to any servers/i.test(
        error?.message || "",
      );

    if (NODE_ENV === "production" || !localDbUnavailable) {
      throw error;
    }

    console.warn(
      "Local MongoDB not available; starting an in-memory MongoDB instance for local development.",
    );
    const memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri();
    await mongoose.connect(memoryUri);
    return memoryUri;
  }
}

const serverStartup = connectDatabase()
  .then(async (uri) => {
    console.log("MongoDB connected");
    await seed();
    return app.listen(PORT, () => console.log(` Server on port ${PORT}`));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

// Exported for integration tests: `await app.startup` resolves to the
// listening HTTP server. Normal boots (node server.js / index.js) are
// unaffected — the startup chain still runs on require.
module.exports = app;
module.exports.startup = serverStartup;
