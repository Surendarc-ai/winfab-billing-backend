const mongoose = require("mongoose");
const PurchaseOrder = require("../models/PurchaseOrder");
const SalesInvoice = require("../models/SalesInvoice");

async function nextBillNo() {
  const count = await SalesInvoice.countDocuments();
  const year = new Date().getFullYear();
  return `BILL-${year}-${String(count + 1).padStart(4, "0")}`;
}

async function listInvoices(req, res) {
  const filter = {};
  if (req.query.poId) filter.purchaseOrder = req.query.poId;
  if (req.query.poNumber) filter.poNumber = req.query.poNumber;

  const invoices = await SalesInvoice.find(filter)
    .populate("purchaseOrder", "poNumber supplier status")
    .sort({ createdAt: -1 });
  res.json(invoices);
}

async function getInvoice(req, res) {
  const invoice = await SalesInvoice.findById(req.params.id).populate(
    "purchaseOrder",
    "poNumber supplier status items"
  );
  if (!invoice) {
    return res.status(404).json({ message: "Sales invoice not found" });
  }
  res.json(invoice);
}

async function createInvoice(req, res) {
  const { purchaseOrderId, billNo, billDate, notes, items, paymentReceived } =
    req.body;

  if (!purchaseOrderId || !items?.length) {
    return res.status(400).json({
      message: "purchaseOrderId and items are required",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const po = await PurchaseOrder.findById(purchaseOrderId).session(session);
    if (!po) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Purchase order not found" });
    }

    if (po.status === "cancelled") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Cannot invoice a cancelled PO" });
    }

    const invoiceItems = [];

    for (const line of items) {
      const poItem = po.items.id(line.poItemId);
      if (!poItem) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `PO item not found: ${line.poItemId}`,
        });
      }

      const qty = Number(line.qty) || 0;
      const remaining = poItem.qty - poItem.billedQty;

      if (qty <= 0) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Invoice qty must be > 0" });
      }

      if (qty > remaining) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Qty ${qty} exceeds remaining ${remaining} for ${poItem.partNo}`,
        });
      }

      const rate =
        line.rate !== undefined && line.rate !== null
          ? Number(line.rate)
          : poItem.rate;
      const amount = Number((qty * rate).toFixed(2));

      poItem.billedQty = Number((poItem.billedQty + qty).toFixed(4));

      invoiceItems.push({
        poItemId: poItem._id,
        partNo: poItem.partNo,
        description: poItem.description,
        qty,
        rate,
        amount,
      });
    }

    po.refreshStatus();
    await po.save({ session });

    const totalAmount = Number(
      invoiceItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)
    );

    const [invoice] = await SalesInvoice.create(
      [
        {
          billNo: billNo || (await nextBillNo()),
          purchaseOrder: po._id,
          poNumber: po.poNumber,
          billDate: billDate || Date.now(),
          items: invoiceItems,
          totalAmount,
          paymentReceived: Boolean(paymentReceived),
          paymentDate: paymentReceived ? new Date() : undefined,
          notes: notes || "",
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const populated = await SalesInvoice.findById(invoice._id).populate(
      "purchaseOrder",
      "poNumber supplier status"
    );
    res.status(201).json(populated);
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function updateInvoice(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await SalesInvoice.findById(req.params.id).session(session);
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
    } = req.body;

    if (billNo !== undefined) {
      const trimmed = String(billNo).trim();
      if (!trimmed) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Bill no is required" });
      }
      invoice.billNo = trimmed;
    }

    if (billDate) invoice.billDate = billDate;
    if (notes !== undefined) invoice.notes = notes;

    if (paymentReceived !== undefined) {
      invoice.paymentReceived = Boolean(paymentReceived);
      invoice.paymentDate = invoice.paymentReceived ? new Date() : undefined;
    }

    if (items?.length) {
      const po = await PurchaseOrder.findById(invoice.purchaseOrder).session(
        session
      );
      if (!po) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Purchase order not found" });
      }

      // Release previously billed qty from this invoice
      for (const oldLine of invoice.items) {
        const poItem = po.items.id(oldLine.poItemId);
        if (poItem) {
          poItem.billedQty = Math.max(
            0,
            Number((poItem.billedQty - oldLine.qty).toFixed(4))
          );
        }
      }

      const nextItems = [];
      for (const line of items) {
        const poItem = po.items.id(line.poItemId);
        if (!poItem) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `PO item not found: ${line.poItemId}`,
          });
        }

        const qty = Number(line.qty) || 0;
        const remaining = poItem.qty - poItem.billedQty;

        if (qty <= 0) {
          await session.abortTransaction();
          return res.status(400).json({ message: "Invoice qty must be > 0" });
        }

        if (qty > remaining) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `Qty ${qty} exceeds remaining ${remaining} for ${poItem.partNo}`,
          });
        }

        const rate =
          line.rate !== undefined && line.rate !== null
            ? Number(line.rate)
            : poItem.rate;
        const amount = Number((qty * rate).toFixed(2));

        poItem.billedQty = Number((poItem.billedQty + qty).toFixed(4));

        nextItems.push({
          poItemId: poItem._id,
          partNo: poItem.partNo,
          description: poItem.description,
          qty,
          rate,
          amount,
        });
      }

      invoice.items = nextItems;
      invoice.totalAmount = Number(
        nextItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)
      );

      po.refreshStatus();
      await po.save({ session });
    }

    await invoice.save({ session });
    await session.commitTransaction();

    const populated = await SalesInvoice.findById(invoice._id).populate(
      "purchaseOrder",
      "poNumber supplier status"
    );
    res.json(populated);
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function deleteInvoice(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await SalesInvoice.findById(req.params.id).session(session);
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Sales invoice not found" });
    }

    const po = await PurchaseOrder.findById(invoice.purchaseOrder).session(
      session
    );

    if (po) {
      for (const line of invoice.items) {
        const poItem = po.items.id(line.poItemId);
        if (poItem) {
          poItem.billedQty = Math.max(
            0,
            Number((poItem.billedQty - line.qty).toFixed(4))
          );
        }
      }
      po.refreshStatus();
      await po.save({ session });
    }

    await invoice.deleteOne({ session });
    await session.commitTransaction();
    res.json({ message: "Sales invoice deleted" });
  } catch (err) {
    await session.abortTransaction();
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
