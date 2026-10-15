const Customer = require("../models/Customer");

function sanitize(body = {}) {
  const gstPercentage = Number(body.gstPercentage);
  return {
    name: body.name?.trim(),
    email: body.email?.trim().toLowerCase() || "",
    phone: body.phone?.trim() || "",
    gstNumber: body.gstNumber?.trim() || "",
    hsnCode: body.hsnCode?.trim() || "",
    gstPercentage: Number.isFinite(gstPercentage)
      ? Math.min(100, Math.max(0, gstPercentage))
      : 0,
    address: body.address?.trim() || "",
    city: body.city?.trim() || "",
    state: body.state?.trim() || "",
    notes: body.notes?.trim() || "",
    active: body.active !== undefined ? Boolean(body.active) : true,
  };
}

const notDeleted = { isDeleted: { $ne: true } };

async function listCustomers(req, res) {
  const filter = { ...notDeleted };
  if (req.query.active === "true") filter.active = true;
  if (req.query.active === "false") filter.active = false;
  const customers = await Customer.find(filter).sort({ name: 1 });
  res.json(customers);
}

async function getCustomer(req, res) {
  const customer = await Customer.findOne({
    _id: req.params.id,
    ...notDeleted,
  });
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  res.json(customer);
}

async function createCustomer(req, res) {
  const data = sanitize(req.body);
  if (!data.name) {
    return res.status(400).json({ message: "Name is required" });
  }
  const customer = await Customer.create(data);
  res.status(201).json(customer);
}

async function updateCustomer(req, res) {
  const data = sanitize(req.body);
  if (!data.name) {
    return res.status(400).json({ message: "Name is required" });
  }
  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, ...notDeleted },
    data,
    { new: true, runValidators: true }
  );
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  res.json(customer);
}

async function deleteCustomer(req, res) {
  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, ...notDeleted },
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  res.json({ message: "Customer moved to recycle bin" });
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
