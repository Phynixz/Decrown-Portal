const mongoose = require("mongoose");

const unitSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    location: { type: String, required: true, trim: true, index: true },
    unitCode: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    unitType: {
      type: String,
      enum: ["room", "apartment", "house", "shop", "office", "other"],
      default: "room",
    },
    status: {
      type: String,
      enum: ["available", "maintenance", "inactive"],
      default: "available",
    },
    rentAmount: { type: Number, min: 0, default: null },
    applicationHoldId: { type: mongoose.Schema.Types.ObjectId, ref: "TenantApplication", default: null },
  },
  { timestamps: true },
);

unitSchema.index({ propertyId: 1, unitCode: 1 }, { unique: true });
unitSchema.index({ propertyId: 1, label: 1 }, { unique: true });

module.exports = mongoose.model("Unit", unitSchema);
