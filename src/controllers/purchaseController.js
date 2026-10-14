const PurchaseOrder = require("../models/PurchaseOrder");

function normalizeItems(items = [], existingItems = []) {
  const existingMap = new Map(
    existingItems.map((item) => [String(item._id), item])
  );

  return items.map((item) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const existing = item._id ? existingMap.get(String(item._id)) : null;
    const billedQty = existing ? Number(existing.billedQty) || 0 : 0;

    if (qty < billedQty) {
      const err = new Error(
        `Qty for ${item.partNo || "item"} cannot be less than billed qty (${billedQty})`
      );
      err.status = 400;
      throw err;
    }

    const normalized = {
      partNo: item.partNo,
      description: item.description,
      qty,
      rate,
      amount: Number((qty * rate).toFixed(2)),
      billedQty,
      unit: item.unit || "nos",
      scheduleDate: item.scheduleDate || undefined,
      deliverDate: item.deliverDate || undefined,
    };

    if (item._id) normalized._id = item._id;
    return normalized;
  });
}

async function listPurchases(_req, res) {
  const orders = await PurchaseOrder.find().sort({ createdAt: -1 });
  res.json(orders);
}

async function getPurchase(req, res) {
  const order = await PurchaseOrder.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Purchase order not found" });
  }
  res.json(order);
}

async function createPurchase(req, res) {
  const { poNumber, supplier, poDate, notes, items } = req.body;

  if (!poNumber || !supplier || !items?.length) {
    return res.status(400).json({
      message: "poNumber, supplier, and items are required",
    });
  }

  const normalized = normalizeItems(items);
  const totalAmount = Number(
    normalized.reduce((sum, item) => sum + item.amount, 0).toFixed(2)
  );

  const order = await PurchaseOrder.create({
    poNumber: poNumber.trim(),
    supplier: supplier.trim(),
    poDate: poDate || Date.now(),
    notes: notes || "",
    items: normalized,
    totalAmount,
  });

  res.status(201).json(order);
}

async function updatePurchase(req, res) {
  const order = await PurchaseOrder.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Purchase order not found" });
  }

  const { poNumber, supplier, poDate, notes, items, status } = req.body;

  if (poNumber) order.poNumber = poNumber.trim();
  if (supplier) order.supplier = supplier.trim();
  if (poDate) order.poDate = poDate;
  if (notes !== undefined) order.notes = notes;
  if (status) order.status = status;

  if (items?.length) {
    order.items = normalizeItems(items, order.items);
    order.totalAmount = Number(
      order.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)
    );
    order.refreshStatus();
  }

  await order.save();
  res.json(order);
}

async function deletePurchase(req, res) {
  const order = await PurchaseOrder.findByIdAndDelete(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Purchase order not found" });
  }
  res.json({ message: "Purchase order deleted" });
}

module.exports = {
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
};
