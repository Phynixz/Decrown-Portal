const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// This is YOU — the person approving new clients — not any client's own
// Admin account. Deliberately a separate model/collection so it keeps
// working unchanged once Phase 2 splits client data into its own DBs.
const PlatformAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true },
);

PlatformAdminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

PlatformAdminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("PlatformAdmin", PlatformAdminSchema);
