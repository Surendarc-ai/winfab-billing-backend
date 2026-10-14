const mongoose = require("mongoose");

const salesLineSchema = new mongoose.Schema(
  {
    poItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    partNo: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0.0001 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const salesInvoiceSchema = new mongoose.Schema(
  {
    billNo: { type: String, required: true, unique: true, trim: true },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
    },
    poNumber: { type: String, required: true, trim: true },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    customerName: { type: String, trim: true, default: "" },
    billDate: { type: Date, default: Date.now },
    items: {
      type: [salesLineSchema],
      validate: [(v) => v.length > 0, "At least one line item is required"],
    },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentReceived: { type: Boolean, default: false },
    paymentDate: { type: Date },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SalesInvoice", salesInvoiceSchema);
