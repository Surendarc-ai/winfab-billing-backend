const express = require("express");
const {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require("../controllers/supplierController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", listSuppliers);
router.get("/:id", getSupplier);
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

module.exports = router;
