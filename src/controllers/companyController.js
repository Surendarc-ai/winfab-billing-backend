const Company = require("../models/Company");

const DEFAULTS = {
  name: "",
  logo: "",
  address: "",
  gstin: "",
  email: "",
  bankName: "Union Bank Perungudi",
  accountNo: "158613100000177",
  ifscCode: "UBIN0815861",
  panNo: "CVFPM7467R",
};

const MAX_LOGO_CHARS = 900_000; // ~650KB binary as base64

function sanitize(body = {}) {
  const logo = typeof body.logo === "string" ? body.logo : "";

  return {
    name: body.name?.trim() || "",
    logo,
    address: body.address?.trim() || "",
    gstin: body.gstin?.trim() || "",
    email: body.email?.trim().toLowerCase() || "",
    bankName: body.bankName?.trim() || "",
    accountNo: body.accountNo?.trim() || "",
    ifscCode: body.ifscCode?.trim() || "",
    panNo: body.panNo?.trim() || "",
  };
}

async function getOrCreateCompany() {
  let company = await Company.findOne().sort({ createdAt: 1 }).lean();
  if (!company) {
    company = (await Company.create(DEFAULTS)).toObject();
  }
  return company;
}

async function getCompany(_req, res) {
  const company = await getOrCreateCompany();
  res.json(company);
}

async function updateCompany(req, res) {
  const data = sanitize(req.body);
  if (!data.name) {
    return res.status(400).json({ message: "Company name is required" });
  }
  if (data.logo && data.logo.length > MAX_LOGO_CHARS) {
    return res
      .status(400)
      .json({ message: "Logo is too large. Use an image under 500KB." });
  }

  let company = await Company.findOne().sort({ createdAt: 1 });
  if (!company) {
    company = await Company.create(data);
  } else {
    Object.assign(company, data);
    await company.save();
  }
  res.json(company);
}

module.exports = {
  getCompany,
  updateCompany,
};
