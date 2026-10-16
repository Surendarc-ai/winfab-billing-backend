const express = require("express");
const {
  listInvoices,
  getInvoice,
  previewNextBillNo,
  createInvoice,
  updateInvoice,
  deleteInvoice,
} = require("../controllers/salesInvoiceController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", listInvoices);
router.get("/next-bill-no", previewNextBillNo);
router.get("/:id", getInvoice);
router.post("/", createInvoice);
router.put("/:id", updateInvoice);
router.delete("/:id", deleteInvoice);

module.exports = router;
