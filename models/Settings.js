const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  location: {
    type: String,
    required: true,
    trim: true,
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
  roomCount: {
    type: Number,
    min: 0,
  },
});

module.exports = mongoose.model("Settings", settingsSchema);
