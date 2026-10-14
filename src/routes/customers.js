const express = require("express");
const {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", listCustomers);
router.get("/:id", getCustomer);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

module.exports = router;
