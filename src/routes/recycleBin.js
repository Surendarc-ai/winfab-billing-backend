const express = require("express");
const {
  listRecycleBin,
  restoreItem,
  purgeItem,
} = require("../controllers/recycleBinController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", listRecycleBin);
router.post("/:type/:id/restore", restoreItem);
router.delete("/:type/:id", purgeItem);

module.exports = router;
