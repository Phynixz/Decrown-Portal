const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  role: { type: String, enum: ["superadmin", "admin"], default: "admin" },
  createdAt: { type: Date, default: Date.now },
});

// Hash password before saving
adminSchema.pre("save", async function () {
  if (!this.isModified("password") || this.$locals.passwordAlreadyHashed)
    return;
  this.password = await bcrypt.hash(this.password, 10);
});

adminSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("Admin", adminSchema);
