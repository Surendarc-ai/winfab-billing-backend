const mongoose = require("mongoose");
const PurchaseOrder = require("../models/PurchaseOrder");
const SalesInvoice = require("../models/SalesInvoice");
const Customer = require("../models/Customer");

const notDeleted = { isDeleted: { $ne: true } };

async function resolveCustomer(customerId) {
  if (!customerId) return { customerId: null, customerName: "" };
  const customer = await Customer.findOne({
    _id: customerId,
    ...notDeleted,
  });
  if (!customer) {
    const err = new Error("Customer not found");
    err.status = 400;
    throw err;
  }
  return { customerId: customer._id, customerName: customer.name };
}

async function nextBillNo() {
  const count = await SalesInvoice.countDocuments();
  const year = new Date().getFullYear();
  return `BILL-${year}-${String(count + 1).padStart(4, "0")}`;
}

function uniqueIds(ids = []) {
  return [
    ...new Set(
      ids
        .filter((id) => id !== undefined && id !== null && id !== "")
        .map((id) => String(id))
        .filter(
          (id) =>
            id &&
            id !== "undefined" &&
            id !== "null" &&
            mongoose.isValidObjectId(id)
        )
    ),
  ];
}

async function loadPoMap(poIds, session, { includeDeleted = false } = {}) {
  const ids = uniqueIds(poIds);
  const filter = { _id: { $in: ids } };
  if (!includeDeleted) filter.isDeleted = { $ne: true };
  const query = PurchaseOrder.find(filter);
  if (session) query.session(session);
  const pos = await query;
  const map = new Map(pos.map((po) => [String(po._id), po]));
  for (const id of ids) {
    if (!map.has(id)) {
      const err = new Error(`Purchase order not found: ${id}`);
      err.status = 404;
      throw err;
    }
  }
  return map;
}

function releaseInvoiceQty(invoice, poMap) {
  for (const oldLine of invoice.items) {
    const poId = String(oldLine.purchaseOrder || invoice.purchaseOrder || "");
    const po = poMap.get(poId);
    if (!po) continue;
    const poItem = po.items.id(oldLine.poItemId);
    if (poItem) {
      poItem.billedQty = Math.max(
        0,
        Number((poItem.billedQty - oldLine.qty).toFixed(4))
      );
    }
  }
}

function buildInvoiceItems(items, poMap) {
  const invoiceItems = [];

  for (const line of items) {
    const purchaseOrderId = String(
      line.purchaseOrderId || line.purchaseOrder || ""
    );
    if (!purchaseOrderId) {
      const err = new Error("Each item needs purchaseOrderId");
      err.status = 400;
      throw err;
    }

    const po = poMap.get(purchaseOrderId);
    if (!po) {
      const err = new Error(`Purchase order not found: ${purchaseOrderId}`);
      err.status = 404;
      throw err;
    }

    if (po.status === "cancelled") {
      const err = new Error(`Cannot invoice cancelled PO ${po.poNumber}`);
      err.status = 400;
      throw err;
    }

    const poItem = po.items.id(line.poItemId);
    if (!poItem) {
      const err = new Error(`PO item not found: ${line.poItemId}`);
      err.status = 400;
      throw err;
    }

    const qty = Number(line.qty) || 0;
    const remaining = poItem.qty - poItem.billedQty;

    if (qty <= 0) {
      const err = new Error("Invoice qty must be > 0");
      err.status = 400;
      throw err;
    }

    if (qty > remaining) {
      const err = new Error(
        `Qty ${qty} exceeds remaining ${remaining} for ${po.poNumber} / ${poItem.partNo}`
      );
      err.status = 400;
      throw err;
    }

    const rate =
      line.rate !== undefined && line.rate !== null
        ? Number(line.rate)
        : poItem.rate;
    const amount = Number((qty * rate).toFixed(2));

    poItem.billedQty = Number((poItem.billedQty + qty).toFixed(4));

    invoiceItems.push({
      purchaseOrder: po._id,
      poNumber: po.poNumber,
      poItemId: poItem._id,
      partNo: poItem.partNo,
      description: poItem.description,
      qty,
      rate,
      amount,
    });
  }

  return invoiceItems;
}

async function savePoMap(poMap, session) {
  for (const po of poMap.values()) {
    po.refreshStatus();
    await po.save({ session });
  }
}

function applyPoRefs(invoice, invoiceItems) {
  const poIds = uniqueIds(invoiceItems.map((item) => item.purchaseOrder));
  const poNumbers = [
    ...new Set(invoiceItems.map((item) => item.poNumber).filter(Boolean)),
  ];
  invoice.purchaseOrders = poIds;
  invoice.poNumbers = poNumbers;
  invoice.purchaseOrder = poIds[0] || undefined;
  invoice.poNumber = poNumbers.join(", ");
  invoice.items = invoiceItems;
  invoice.totalAmount = Number(
    invoiceItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)
  );
}

function invoicePoIds(invoice) {
  const fromArray = (invoice.purchaseOrders || []).map(String);
  const fromLegacy = invoice.purchaseOrder ? [String(invoice.purchaseOrder)] : [];
  const fromItems = (invoice.items || [])
    .map((item) => String(item.purchaseOrder || ""))
    .filter(Boolean);
  return uniqueIds([...fromArray, ...fromLegacy, ...fromItems]);
}

async function listInvoices(req, res) {
  const filter = { ...notDeleted };
  if (req.query.poId) {
    filter.$or = [
      { purchaseOrder: req.query.poId },
      { purchaseOrders: req.query.poId },
      { "items.purchaseOrder": req.query.poId },
    ];
  }
  if (req.query.poNumber) {
    filter.$or = [
      { poNumber: req.query.poNumber },
      { poNumbers: req.query.poNumber },
      { "items.poNumber": req.query.poNumber },
    ];
  }

  const invoices = await SalesInvoice.find(filter)
    .populate("purchaseOrder", "poNumber supplier status")
    .populate("purchaseOrders", "poNumber supplier status")
    .sort({ createdAt: -1 });
  res.json(invoices);
}

async function getInvoice(req, res) {
  const invoice = await SalesInvoice.findOne({
    _id: req.params.id,
    ...notDeleted,
  })
    .populate("purchaseOrder", "poNumber supplier status items")
    .populate("purchaseOrders", "poNumber supplier status items");
  if (!invoice) {
    return res.status(404).json({ message: "Sales invoice not found" });
  }
  res.json(invoice);
}

async function createInvoice(req, res) {
  const {
    purchaseOrderId,
    purchaseOrderIds,
    billNo,
    billDate,
    notes,
    items,
    paymentReceived,
    customerId,
  } = req.body;

  if (!items?.length) {
    return res.status(400).json({
      message: "items are required",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const customer = await resolveCustomer(customerId);
    const poIds = uniqueIds([
      ...(purchaseOrderIds || []),
      purchaseOrderId || null,
      ...items.map((line) => line.purchaseOrderId || line.purchaseOrder || null),
    ]);

    if (!poIds.length) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "At least one purchase order is required",
      });
    }

    const poMap = await loadPoMap(poIds, session);
    const invoiceItems = buildInvoiceItems(items, poMap);
    await savePoMap(poMap, session);

    const draft = {
      billNo: billNo || (await nextBillNo()),
      customerId: customer.customerId,
      customerName: customer.customerName,
      billDate: billDate || Date.now(),
      paymentReceived: Boolean(paymentReceived),
      paymentDate: paymentReceived ? new Date() : undefined,
      notes: notes || "",
      items: [],
      totalAmount: 0,
      poNumber: "",
    };
    applyPoRefs(draft, invoiceItems);

    const [invoice] = await SalesInvoice.create([draft], { session });
    await session.commitTransaction();

    const populated = await SalesInvoice.findById(invoice._id)
      .populate("purchaseOrder", "poNumber supplier status")
      .populate("purchaseOrders", "poNumber supplier status");
    res.status(201).json(populated);
  } catch (err) {
    await session.abortTransaction();
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  } finally {
    session.endSession();
  }
}

async function updateInvoice(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await SalesInvoice.findOne({
      _id: req.params.id,
      ...notDeleted,
    }).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Sales invoice not found" });
    }

    const {
      billNo,
      billDate,
      notes,
      paymentReceived,
      items,
      customerId,
      purchaseOrderIds,
      purchaseOrderId,
    } = req.body;

    if (billNo !== undefined) {
      const trimmed = String(billNo).trim();
      if (!trimmed) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Bill no is required" });
      }
      invoice.billNo = trimmed;
    }

    if (customerId !== undefined) {
      const customer = await resolveCustomer(customerId || null);
      invoice.customerId = customer.customerId;
      invoice.customerName = customer.customerName;
    }

    if (billDate) invoice.billDate = billDate;
    if (notes !== undefined) invoice.notes = notes;

    if (paymentReceived !== undefined) {
      invoice.paymentReceived = Boolean(paymentReceived);
      invoice.paymentDate = invoice.paymentReceived ? new Date() : undefined;
    }

    if (items?.length) {
      const nextPoIds = uniqueIds([
        ...(purchaseOrderIds || []),
        purchaseOrderId || null,
        ...items.map((line) => line.purchaseOrderId || line.purchaseOrder || null),
        ...invoicePoIds(invoice),
      ]);
      const poMap = await loadPoMap(nextPoIds, session);

      releaseInvoiceQty(invoice, poMap);
      const invoiceItems = buildInvoiceItems(items, poMap);
      applyPoRefs(invoice, invoiceItems);
      await savePoMap(poMap, session);
    }

    await invoice.save({ session });
    await session.commitTransaction();

    const populated = await SalesInvoice.findById(invoice._id)
      .populate("purchaseOrder", "poNumber supplier status")
      .populate("purchaseOrders", "poNumber supplier status");
    res.json(populated);
  } catch (err) {
    await session.abortTransaction();
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  } finally {
    session.endSession();
  }
}

async function deleteInvoice(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await SalesInvoice.findOne({
      _id: req.params.id,
      ...notDeleted,
    }).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Sales invoice not found" });
    }

    const poIds = invoicePoIds(invoice);
    if (poIds.length) {
      const poMap = await loadPoMap(poIds, session, { includeDeleted: true });
      releaseInvoiceQty(invoice, poMap);
      await savePoMap(poMap, session);
    }

    invoice.isDeleted = true;
    invoice.deletedAt = new Date();
    await invoice.save({ session });
    await session.commitTransaction();
    res.json({ message: "Sales invoice moved to recycle bin" });
  } catch (err) {
    await session.abortTransaction();
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
};
