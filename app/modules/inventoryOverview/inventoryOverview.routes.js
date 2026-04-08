const router = require("express").Router();
const InventoryOverviewController = require("./inventoryOverview.controller");

// ✅ LIST (UI table এর জন্য)
router.get("/list", InventoryOverviewController.getInventoryOverviewList);

// ✅ SUMMARY (cards এর জন্য)
router.get("/summary", InventoryOverviewController.getInventoryOverviewSummary);

module.exports = router;
