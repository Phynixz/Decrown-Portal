const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  location: { type: String, enum: ["Malete", "Ila-Orangun"], required: true },
  type: { type: String, enum: ["tenant", "shop"], default: "tenant" },
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  phone: { type: String, required: true, trim: true },
  guardianName: { type: String, trim: true },
  guardianPhone: { type: String, trim: true },
  session: { type: String, required: true },
  level: String,
  roomNo: String,
  amount: { type: Number, default: 0 },
  paymentDate: String,
  passport: String,
  paymentProof: String,
  renewedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  retainPending: { type: Boolean, default: false }, // true = tenant retained but hasn't paid yet
  createdAt: { type: Date, default: Date.now },
});

// Prevent two tenants in the same room for the same location+session
userSchema.index({ location: 1, roomNo: 1, session: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
