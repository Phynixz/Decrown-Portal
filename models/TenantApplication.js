const mongoose = require("mongoose");

const tenantApplicationSchema = new mongoose.Schema(
  {
    tenantAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "TenantAccount", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    guardianName: { type: String, required: true, trim: true },
    guardianPhone: { type: String, required: true, trim: true },
    matricNumber: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    lga: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", required: true },
    roomNo: { type: String, required: true, trim: true },
    session: { type: String, required: true },
    rentAmount: { type: Number, min: 0, default: 0 },
    passport: { type: String, required: true },
    idCard: { type: String, required: true },
    agreementCopy: { type: String, default: null },
    paymentProof: { type: String, default: null },
    paymentDate: { type: String, default: null },
    paymentVerifiedAt: { type: Date, default: null },
    allocatedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["under_review", "rejected", "agreement_requested", "agreement_submitted", "payment_unlocked", "payment_submitted", "payment_verified", "allocated"],
      default: "under_review",
      index: true,
    },
    managementNote: { type: String, default: "" },
  },
  { timestamps: true },
);

tenantApplicationSchema.index({ tenantAccountId: 1, createdAt: -1 });

module.exports = mongoose.model("TenantApplication", tenantApplicationSchema);
