const dns = require("dns");

dns.setServers(["8.8.8.8"]);

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const ExcelJS = require("exceljs");
const cookieParser = require("cookie-parser");

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const NODE_ENV = process.env.NODE_ENV || "development";

if (!MONGO_URI || !JWT_SECRET) {
  const missing = [];
  if (!MONGO_URI) missing.push("MONGO_URI");
  if (!JWT_SECRET) missing.push("JWT_SECRET");
  console.error(
    `\n❌ Missing required environment variable(s): ${missing.join(", ")}`,
  );
  console.error(
    "Set them in your hosting dashboard (e.g. Render → Environment tab) or in a .env file for local development.\n",
  );
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

const User = require("./models/User");
const Admin = require("./models/Admin");
const Settings = require("./models/Settings");
const Registration = require("./models/Registration");
const upload = require("./multer");

// â”€â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    if (d.role !== "admin" && d.role !== "superadmin")
      return res.status(403).json({ error: "Not authorized" });
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

function sanitizeLocation(value) {
  const loc = sanitizeString(value);
  return ["Malete", "Ila-Orangun"].includes(loc) ? loc : "";
}

function sanitizeType(value) {
  const type = sanitizeString(value).toLowerCase();
  return ["tenant", "shop"].includes(type) ? type : "tenant";
}

function sanitizeRole(value) {
  const role = sanitizeString(value).toLowerCase();
  return ["admin", "superadmin"].includes(role) ? role : "admin";
}

function sanitizeSession(value) {
  return sanitizeString(value);
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function verifySuperAdmin(req, res, next) {
  verifyAdmin(req, res, () => {
    if (req.admin.role !== "superadmin")
      return res.status(403).json({ error: "Superadmin only" });
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
    req.tenant = d;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

// â”€â”€â”€ Admin Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/admin/login", async (req, res) => {
  const email = sanitizeEmail(req.body.email);
  const password = sanitizeString(req.body.password);
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await admin.comparePassword(password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      { id: admin._id, email: admin.email, name: admin.name, role: admin.role },
      JWT_SECRET,
      { expiresIn: "8h" },
    );
    res.json({ token, name: admin.name, role: admin.role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/admin/list", verifySuperAdmin, async (req, res) => {
  try {
    const admins = await Admin.find({}, "-password").sort({ createdAt: 1 });
    res.json(admins);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
  }
});

app.delete("/admin/:id", verifySuperAdmin, async (req, res) => {
  try {
    if (req.params.id === req.admin.id)
      return res.status(400).json({ error: "Cannot delete yourself" });
    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: "Admin removed" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// â”€â”€â”€ Tenant Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/tenant/login", async (req, res) => {
  const email = sanitizeEmail(req.body.email);
  const phone = sanitizePhone(req.body.phone);
  if (!email || !phone)
    return res.status(400).json({ error: "Email and phone required" });
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
      { id: user._id, email: user.email, type: "tenant" },
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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
        "session roomNo amount paymentDate paymentProof retainPending renewedFrom _id type level",
      );
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
      res.status(500).json({ error: e.message });
    }
  },
);

// Grant re-upload access with 24hr window
app.put("/admin/grant-reupload/:id", verifyAdmin, async (req, res) => {
  try {
    const { passport, idCard, proof } = req.body;

    if (!passport && !idCard && !proof)
      return res.status(400).json({ error: "Select at least one document" });

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(req.params.id, {
      canReuploadPassport: !!passport,
      canReuploadIdCard: !!idCard,
      canReuploadProof: !!proof,
      reuploadExpiresAt: expires,
    });

    res.json({ message: "Re-upload access granted for 24 hours" });
  } catch (e) {
    res.status(500).json({ error: e.message });
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

      if (!["passport", "idCard", "paymentProof"].includes(field))
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
        !user.canReuploadProof
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
      res.status(500).json({ error: e.message });
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
  return state ? state.open : false;
}

// ----- Public Routes -----
app.get("/current-session", async (req, res) => {
  const registrationOpen = await isRegistrationOpen(getNextSession());
  res.json({
    session: getSession(),
    next: getNextSession(),
    registrationOpen,
  });
});

app.get("/current-amount", async (req, res) => {
  try {
    const { location } = req.query;
    if (!location) return res.status(400).json({ error: "location required" });
    const s = await Settings.findOne({ location });
    if (!s) return res.status(404).json({ error: "Settings not found" });
    res.json({ amount: s.rentAmount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FIX: /user/:id is now PUBLIC so receipt page works without admin token
app.get("/user/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: "Not found" });
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
      idCard: u.idCard,
      paymentProof: u.paymentProof,
      retainPending: u.retainPending,
      renewedFrom: u.renewedFrom,
      type: u.type,
      createdAt: u.createdAt,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function generateReceiptNumber(location) {
  const prefix = location === "Malete" ? "DCM" : "DCI";
  const year = new Date().getFullYear();
  const count = await User.countDocuments({ location });
  const num = String(count + 1).padStart(4, "0");
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
        roomNo,
        paymentDate,
        type = "tenant",
        termsAccepted,
      } = req.body;

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

      const safeLocation = sanitizeLocation(location);
      const safeName = sanitizeString(name);
      const safeEmail = sanitizeEmail(email);
      const safePhone = sanitizePhone(phone);
      const safeGuardianName = sanitizeString(guardianName);
      const safeGuardianPhone = sanitizePhone(guardianPhone);
      const safeLevel = sanitizeString(level);
      const safeRoomNo = sanitizeString(roomNo);
      const safeType = sanitizeType(type);
      const safePaymentDate = sanitizeString(paymentDate);

      if (!safeLocation)
        return res.status(400).json({ error: "Invalid location" });

      const session = getSession();
      const roomTaken = await User.findOne({
        location: safeLocation,
        roomNo: safeRoomNo,
        session,
      });
      if (roomTaken)
        return res
          .status(400)
          .json({ error: "Room already occupied for this session" });

      const setting = await Settings.findOne({ location: safeLocation });
      await new User({
        location: safeLocation,
        type: safeType,
        name: safeName,
        email: safeEmail,
        phone: safePhone,
        guardianName: safeGuardianName,
        guardianPhone: safeGuardianPhone,
        session,
        level: safeLevel,
        roomNo: safeRoomNo,
        amount: setting?.rentAmount ?? 0,
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
        receiptNumber: await generateReceiptNumber(location),
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
      res.status(500).json({ error: err.message });
    }
  },
);

// â”€â”€â”€ Admin Data Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FIX: supports ?email= so drawer can fetch all sessions for one tenant
app.get("/users", verifyAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.location)
      filter.location = sanitizeLocation(req.query.location);
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
    res.status(500).json({ error: e.message });
  }
});

app.get("/admin/get-amounts", verifyAdmin, async (req, res) => {
  try {
    const settings = await Settings.find();
    const state = await getRegistrationState();
    const r = {
      malete: null,
      ila: null,
      registrationOpen: state ? state.open : false,
    };
    settings.forEach((s) => {
      if (s.location === "Malete") r.malete = s.rentAmount;
      if (s.location === "Ila-Orangun") r.ila = s.rentAmount;
    });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
    res.status(500).json({ error: e.message });
  }
});

app.put("/admin/set-amount", verifyAdmin, async (req, res) => {
  try {
    const { malete, ila } = req.body;
    if (malete != null)
      await Settings.findOneAndUpdate(
        { location: "Malete" },
        { rentAmount: +malete },
        { upsert: true },
      );
    if (ila != null)
      await Settings.findOneAndUpdate(
        { location: "Ila-Orangun" },
        { rentAmount: +ila },
        { upsert: true },
      );
    res.json({ message: "Updated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
    const wb = new ExcelJS.Workbook();
    for (const loc of ["Malete", "Ila-Orangun"]) {
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
      `attachment; filename=decrown-${Date.now()}.xlsx`,
    );
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
  }
});

// ── Get single user for editing ──────────────────────────────────────────────
app.get("/admin/user/:id", verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    if (location) user.location = location;
    if (type) user.type = type;
    if (level) user.level = sanitizeString(level);
    if (roomNo) user.roomNo = sanitizeString(roomNo);
    if (session) user.session = sanitizeString(session);
    if (amount != null) user.amount = Number(amount);
    if (paymentDate) user.paymentDate = sanitizeString(paymentDate);

    await user.save();
    res.json({ message: "User updated successfully", user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function seed() {
  for (const loc of ["Malete", "Ila-Orangun"]) {
    if (!(await Settings.findOne({ location: loc }))) {
      await Settings.create({
        location: loc,
        rentAmount: 150000,
        registrationOpen: true,
      });
    } else {
      await Settings.updateOne(
        { location: loc, registrationOpen: { $exists: false } },
        { $set: { registrationOpen: true } },
      );
    }
  }
  if ((await Admin.countDocuments()) === 0) {
    const defaults = [
      {
        name: "Super Admin",
        email: process.env.ADMIN_EMAIL_1,
        password: process.env.ADMIN_PASS_1,
        role: "superadmin",
      },
      {
        name: "Admin Two",
        email: process.env.ADMIN_EMAIL_2,
        password: process.env.ADMIN_PASS_2,
        role: "admin",
      },
      {
        name: "Admin Three",
        email: process.env.ADMIN_EMAIL_3,
        password: process.env.ADMIN_PASS_3,
        role: "admin",
      },
    ].filter((admin) => admin.email && admin.password);

    if (defaults.length === 0) {
      console.warn(
        "No default admin credentials found in environment variables. Set ADMIN_EMAIL_1/ADMIN_PASS_1, etc.",
      );
    } else {
      for (const d of defaults) await new Admin(d).save();
      console.log(`âœ… ${defaults.length} default admin(s) seeded`);
      if (NODE_ENV !== "production") {
        defaults.forEach((d) =>
          console.log(`   â†’ ${d.email}  /  ${d.password}`),
        );
      }
    }
  }
}

// ── SPA fallback ─────────────────────────────────────────────────────────────
// Serve the React app for client-side routes (/login, /admin, /portal, …).
// Registered last so it only catches GETs that no API route matched.
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (!fs.existsSync(CLIENT_INDEX)) return next();
  res.sendFile(CLIENT_INDEX);
});

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log(" MongoDB connected");
    await seed();
    app.listen(PORT, () => console.log(` Server on port ${PORT}`));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
