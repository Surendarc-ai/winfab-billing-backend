const Customer = require("../models/Customer");

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

async function listCustomers(req, res) {
  const filter = {};
  if (req.query.active === "true") filter.active = true;
  if (req.query.active === "false") filter.active = false;
  const customers = await Customer.find(filter).sort({ name: 1 });
  res.json(customers);
}

async function getCustomer(req, res) {
  const customer = await Customer.findById(req.params.id);
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
  const customer = await Customer.findByIdAndUpdate(req.params.id, data, {
    new: true,
    runValidators: true,
  });
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  res.json(customer);
}

async function deleteCustomer(req, res) {
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) {
    return res.status(404).json({ message: "Customer not found" });
  }
  res.json({ message: "Customer deleted" });
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
