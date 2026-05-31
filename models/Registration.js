const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema({
  session: {
    type: String,
    required: true,
    unique: true,
  },
  open: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Registration", registrationSchema);
