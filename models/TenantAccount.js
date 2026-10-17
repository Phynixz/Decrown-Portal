const mongoose = require("mongoose");

const tenantAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 50 },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

tenantAccountSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("TenantAccount", tenantAccountSchema);
