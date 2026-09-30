const mongoose = require("mongoose");

const platformAuditSchema = new mongoose.Schema(
  {
    actorId: { type: String, default: "" },
    actorName: { type: String, default: "" },
    actorEmail: { type: String, required: true, lowercase: true, trim: true },
    actorRole: {
      type: String,
      enum: ["owner", "reviewer", "viewer", "client", "unknown"],
      default: "unknown",
    },
    action: { type: String, required: true, trim: true },
    resource: { type: String, default: "" },
    resourceId: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    success: { type: Boolean, default: true },
  },
  { timestamps: true },
);

platformAuditSchema.index({ createdAt: -1 });
platformAuditSchema.index({ actorEmail: 1, createdAt: -1 });

module.exports = mongoose.model("PlatformAudit", platformAuditSchema);
