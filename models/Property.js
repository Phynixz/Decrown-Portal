const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    state: { type: String, trim: true, default: "" },
    lga: { type: String, trim: true, default: "" },
    propertyType: {
      type: String,
      enum: ["hostel", "apartment", "house", "commercial", "mixed", "other"],
      default: "hostel",
    },
    address: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending_review", "active", "rejected", "archived"],
      default: "active",
    },
    reviewNote: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

propertySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model("Property", propertySchema);
