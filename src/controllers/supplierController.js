const Supplier = require("../models/Supplier");

function sanitize(body = {}) {
  return {
    name: body.name?.trim(),
    email: body.email?.trim().toLowerCase() || "",
    phone: body.phone?.trim() || "",
    gstNumber: body.gstNumber?.trim() || "",
    address: body.address?.trim() || "",
    city: body.city?.trim() || "",
    state: body.state?.trim() || "",
    notes: body.notes?.trim() || "",
    active: body.active !== undefined ? Boolean(body.active) : true,
  };
}

async function listSuppliers(req, res) {
  const filter = {};
  if (req.query.active === "true") filter.active = true;
  if (req.query.active === "false") filter.active = false;
  const suppliers = await Supplier.find(filter).sort({ name: 1 });
  res.json(suppliers);
}

async function getSupplier(req, res) {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) {
    return res.status(404).json({ message: "Supplier not found" });
  }
  res.json(supplier);
}

async function createSupplier(req, res) {
  const data = sanitize(req.body);
  if (!data.name) {
    return res.status(400).json({ message: "Name is required" });
  }
  const supplier = await Supplier.create(data);
  res.status(201).json(supplier);
}

async function updateSupplier(req, res) {
  const data = sanitize(req.body);
  if (!data.name) {
    return res.status(400).json({ message: "Name is required" });
  }
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, data, {
    new: true,
    runValidators: true,
  });
  if (!supplier) {
    return res.status(404).json({ message: "Supplier not found" });
  }
  res.json(supplier);
}

async function deleteSupplier(req, res) {
  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) {
    return res.status(404).json({ message: "Supplier not found" });
  }
  res.json({ message: "Supplier deleted" });
}

module.exports = {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
