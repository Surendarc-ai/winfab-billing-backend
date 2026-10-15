const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    partNo: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    billedQty: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "nos" },
    scheduleDate: { type: Date },
    deliverDate: { type: Date },
  },
  { _id: true }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true, trim: true },
    supplier: { type: String, required: true, trim: true },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    poDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["open", "partial", "closed", "cancelled"],
      default: "open",
    },
    items: {
      type: [purchaseItemSchema],
      validate: [(v) => v.length > 0, "At least one item is required"],
    },
    totalAmount: { type: Number, required: true, min: 0 },
    notes: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ isDeleted: 1, deletedAt: -1 });

purchaseOrderSchema.methods.refreshStatus = function refreshStatus() {
  const allBilled = this.items.every((item) => item.billedQty >= item.qty);
  const anyBilled = this.items.some((item) => item.billedQty > 0);

  if (allBilled) this.status = "closed";
  else if (anyBilled) this.status = "partial";
  else if (this.status !== "cancelled") this.status = "open";
};

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
