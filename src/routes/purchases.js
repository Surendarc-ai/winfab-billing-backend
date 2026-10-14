const express = require("express");
const {
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
} = require("../controllers/purchaseController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", listPurchases);
router.get("/:id", getPurchase);
router.post("/", createPurchase);
router.put("/:id", updatePurchase);
router.delete("/:id", deletePurchase);

module.exports = router;
