const mongoose = require("mongoose");

// One document per client business (e.g. "De-Crown Cottage", "Client B Hostels").
// This is the top-level record everything else in Phase 2 (Admins, Users,
// Settings, Registrations) will be scoped under via clientId / dbName.
const ClientSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },

    // e.g. "clientb" -> clientb.yourplatform.com
    subdomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]{3,30}$/,
    },

    // Owner's password for their platform login (separate from any
    // per-hostel Admin accounts seeded for them on approval).
    passwordHash: { type: String, required: true },

    // pending_verification -> pending_approval -> active
    //                                          -> rejected
    // active -> suspended (you can flip back to active)
    status: {
      type: String,
      enum: ["pending_verification", "pending_approval", "active", "suspended", "rejected"],
      default: "pending_verification",
    },

    verified: { type: Boolean, default: false },
    verificationCodeHash: { type: String },
    verificationExpires: { type: Date },

    rejectionReason: { type: String },
    approvedAt: { type: Date },

    // Filled in during provisioning (on approval) — Phase 2 will use this
    // to route each client's requests to their own database.
    dbName: { type: String },

    branding: {
      logoUrl: { type: String, default: "" },
      primaryColor: { type: String, default: "#1a3c5e" },
    },

    bankDetails: {
      bankName: { type: String, default: "" },
      accountName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
    },

    // Their campuses/branches/locations — replaces the hardcoded
    // ["Malete", "Ila-Orangun"] whitelist in the current server.js.
    locations: { type: [String], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Client", ClientSchema);
