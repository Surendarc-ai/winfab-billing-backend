const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    logo: { type: String, default: "" },
    address: { type: String, trim: true, default: "" },
    gstin: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    bankName: { type: String, trim: true, default: "Union Bank Perungudi" },
    accountNo: { type: String, trim: true, default: "158613100000177" },
    ifscCode: { type: String, trim: true, default: "UBIN0815861" },
    panNo: { type: String, trim: true, default: "CVFPM7467R" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);
