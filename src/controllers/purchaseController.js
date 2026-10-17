const PurchaseOrder = require("../models/PurchaseOrder");
const Customer = require("../models/Customer");

async function resolveCustomer(body = {}) {
  let customerId = body.customerId || null;
  let customerName = body.customer?.trim() || "";

  // Backward compat: accept old supplier fields as customer
  if (!customerId && body.supplierId) customerId = body.supplierId;
  if (!customerName && body.supplier) customerName = String(body.supplier).trim();

  if (customerId) {
    const customer = await Customer.findOne({
      _id: customerId,
      isDeleted: { $ne: true },
    });
    if (!customer) {
      const err = new Error("Customer not found");
      err.status = 400;
      throw err;
    }
    customerName = customer.name;
  }

  return { customerId, customerName };
}

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

const notDeleted = { isDeleted: { $ne: true } };

async function listPurchases(_req, res) {
  const orders = await PurchaseOrder.find(notDeleted)
    .sort({ createdAt: -1 })
    .lean();
  res.json(orders);
}

async function getPurchase(req, res) {
  const order = await PurchaseOrder.findOne({
    _id: req.params.id,
    ...notDeleted,
  }).lean();
  if (!order) {
    return res.status(404).json({ message: "Purchase order not found" });
  }
  res.json(order);
}

async function createPurchase(req, res) {
  const { poNumber, poDate, notes, items } = req.body;
  const { customerId, customerName } = await resolveCustomer(req.body);

  if (!poNumber || !customerName || !items?.length) {
    return res.status(400).json({
      message: "poNumber, customer (or customerId), and items are required",
    });
  }

  const normalized = normalizeItems(items);
  const totalAmount = Number(
    normalized.reduce((sum, item) => sum + item.amount, 0).toFixed(2)
  );

  const order = await PurchaseOrder.create({
    poNumber: poNumber.trim(),
    customer: customerName,
    customerId,
    // Keep legacy supplier fields in sync for old UI/reads
    supplier: customerName,
    supplierId: null,
    poDate: poDate || Date.now(),
    notes: notes || "",
    items: normalized,
    totalAmount,
  });

  res.status(201).json(order);
}

async function updatePurchase(req, res) {
  const order = await PurchaseOrder.findOne({
    _id: req.params.id,
    ...notDeleted,
  });
  if (!order) {
    return res.status(404).json({ message: "Purchase order not found" });
  }

  const { poNumber, poDate, notes, items, status } = req.body;

  if (poNumber) order.poNumber = poNumber.trim();
  if (
    req.body.customerId !== undefined ||
    req.body.customer ||
    req.body.supplierId !== undefined ||
    req.body.supplier
  ) {
    const { customerId, customerName } = await resolveCustomer(req.body);
    if (!customerName) {
      return res.status(400).json({ message: "Customer is required" });
    }
    order.customer = customerName;
    order.customerId = customerId;
    order.supplier = customerName;
    order.supplierId = null;
  }
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
  const order = await PurchaseOrder.findOneAndUpdate(
    { _id: req.params.id, ...notDeleted },
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );
  if (!order) {
    return res.status(404).json({ message: "Purchase order not found" });
  }
  res.json({ message: "Purchase order moved to recycle bin" });
}

module.exports = {
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
};
