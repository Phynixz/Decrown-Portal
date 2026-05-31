const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  location: {
    type: String,
    enum: ["Malete", "Ila-Orangun"],
    required: true,
    unique: true,
  },
  rentAmount: {
    type: Number,
    required: true,
  },
  registrationOpen: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("Settings", settingsSchema);
