const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const PurchaseOrder = require("../models/PurchaseOrder");
const SalesInvoice = require("../models/SalesInvoice");

const deleted = { isDeleted: true };

const TYPE_MAP = {
  customers: { model: Customer, label: "Customer" },
  suppliers: { model: Supplier, label: "Supplier" },
  purchases: { model: PurchaseOrder, label: "Purchase" },
  "sales-invoices": { model: SalesInvoice, label: "Sales invoice" },
};

function itemLabel(type, doc) {
  if (type === "customers" || type === "suppliers") return doc.name || "—";
  if (type === "purchases") return doc.poNumber || "—";
  if (type === "sales-invoices") return doc.billNo || "—";
  return String(doc._id);
}

async function listRecycleBin(_req, res) {
  const [customers, suppliers, purchases, salesInvoices] = await Promise.all([
    Customer.find(deleted).sort({ deletedAt: -1 }),
    Supplier.find(deleted).sort({ deletedAt: -1 }),
    PurchaseOrder.find(deleted).sort({ deletedAt: -1 }),
    SalesInvoice.find(deleted).sort({ deletedAt: -1 }),
  ]);

  const items = [
    ...customers.map((doc) => ({
      id: doc._id,
      type: "customers",
      typeLabel: "Customer",
      name: itemLabel("customers", doc),
      deletedAt: doc.deletedAt,
      meta: doc.email || doc.phone || "",
    })),
    ...suppliers.map((doc) => ({
      id: doc._id,
      type: "suppliers",
      typeLabel: "Supplier",
      name: itemLabel("suppliers", doc),
      deletedAt: doc.deletedAt,
      meta: doc.email || doc.phone || "",
    })),
    ...purchases.map((doc) => ({
      id: doc._id,
      type: "purchases",
      typeLabel: "Purchase",
      name: itemLabel("purchases", doc),
      deletedAt: doc.deletedAt,
      meta: doc.supplier || "",
    })),
    ...salesInvoices.map((doc) => ({
      id: doc._id,
      type: "sales-invoices",
      typeLabel: "Sales",
      name: itemLabel("sales-invoices", doc),
      deletedAt: doc.deletedAt,
      meta: doc.customerName || doc.poNumber || "",
    })),
  ].sort((a, b) => {
    const ta = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
    const tb = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
    return tb - ta;
  });

  res.json({
    items,
    counts: {
      customers: customers.length,
      suppliers: suppliers.length,
      purchases: purchases.length,
      salesInvoices: salesInvoices.length,
      total: items.length,
    },
  });
}

async function restoreItem(req, res) {
  const { type, id } = req.params;
  const entry = TYPE_MAP[type];
  if (!entry) {
    return res.status(400).json({ message: "Invalid recycle bin type" });
  }
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid id" });
  }

  if (type === "sales-invoices") {
    return restoreSalesInvoice(req, res, id);
  }

  const doc = await entry.model.findOneAndUpdate(
    { _id: id, isDeleted: true },
    { isDeleted: false, deletedAt: null },
    { new: true }
  );
  if (!doc) {
    return res.status(404).json({ message: `${entry.label} not found in bin` });
  }
  res.json({ message: `${entry.label} restored`, item: doc });
}

async function restoreSalesInvoice(req, res, id) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const invoice = await SalesInvoice.findOne({
      _id: id,
      isDeleted: true,
    }).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ message: "Sales invoice not found in bin" });
    }

    // Re-apply billed qty from invoice lines
    const poIds = [
      ...new Set(
        [
          ...(invoice.purchaseOrders || []).map(String),
          invoice.purchaseOrder ? String(invoice.purchaseOrder) : "",
          ...(invoice.items || []).map((item) =>
            String(item.purchaseOrder || "")
          ),
        ].filter(Boolean)
      ),
    ];

    if (poIds.length) {
      const pos = await PurchaseOrder.find({ _id: { $in: poIds } }).session(
        session
      );
      const poMap = new Map(pos.map((po) => [String(po._id), po]));

      for (const line of invoice.items) {
        const poId = String(
          line.purchaseOrder || invoice.purchaseOrder || ""
        );
        const po = poMap.get(poId);
        if (!po || po.isDeleted) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `Cannot restore: purchase order missing or deleted (${line.poNumber || poId})`,
          });
        }
        const poItem = po.items.id(line.poItemId);
        if (!poItem) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `Cannot restore: PO item missing for ${line.partNo}`,
          });
        }
        const remaining = poItem.qty - poItem.billedQty;
        if (line.qty > remaining) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `Cannot restore: qty ${line.qty} exceeds remaining ${remaining} for ${line.partNo}`,
          });
        }
        poItem.billedQty = Number(
          (poItem.billedQty + line.qty).toFixed(4)
        );
      }

      for (const po of poMap.values()) {
        po.refreshStatus();
        await po.save({ session });
      }
    }

    invoice.isDeleted = false;
    invoice.deletedAt = null;
    await invoice.save({ session });
    await session.commitTransaction();
    res.json({ message: "Sales invoice restored", item: invoice });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function purgeItem(req, res) {
  const { type, id } = req.params;
  const entry = TYPE_MAP[type];
  if (!entry) {
    return res.status(400).json({ message: "Invalid recycle bin type" });
  }
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid id" });
  }

  const doc = await entry.model.findOneAndDelete({
    _id: id,
    isDeleted: true,
  });
  if (!doc) {
    return res.status(404).json({ message: `${entry.label} not found in bin` });
  }
  res.json({ message: `${entry.label} permanently deleted` });
}

module.exports = {
  listRecycleBin,
  restoreItem,
  purgeItem,
};
