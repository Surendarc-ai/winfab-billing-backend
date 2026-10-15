const express = require("express");
const { getCompany, updateCompany } = require("../controllers/companyController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", getCompany);
router.put("/", updateCompany);

module.exports = router;
