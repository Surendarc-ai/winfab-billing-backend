const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    gstNumber: { type: String, trim: true, default: "" },
    hsnCode: { type: String, trim: true, default: "" },
    gstPercentage: { type: Number, default: 0, min: 0, max: 100 },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });
customerSchema.index({ isDeleted: 1, deletedAt: -1 });
customerSchema.index({ isDeleted: 1, name: 1 });

module.exports = mongoose.model("Customer", customerSchema);
