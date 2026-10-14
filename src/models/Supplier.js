const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
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

supplierSchema.index({ name: 1 });

module.exports = mongoose.model("Supplier", supplierSchema);
