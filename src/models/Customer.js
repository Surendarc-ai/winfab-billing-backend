const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    gstNumber: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });

module.exports = mongoose.model("Customer", customerSchema);
