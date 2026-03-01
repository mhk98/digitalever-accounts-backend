// // app/modules/InventoryOverview/InventoryOverview.routes.js

// const router = require("express").Router();
// const InventoryOverviewController = require("./inventoryOverview.controller");

// // GET /api/v1/InventoryOverview/summary?from=2026-01-01&to=2026-01-13
// router.get("/summary", InventoryOverviewController.getInventoryOverviewList);

// const InventoryOverviewRoutes = router;
// module.exports = InventoryOverviewRoutes;

// app/modules/InventoryOverview/inventoryOverview.routes.js

const router = require("express").Router();
const InventoryOverviewController = require("./inventoryOverview.controller");

// ✅ LIST (UI table এর জন্য)
router.get("/list", InventoryOverviewController.getInventoryOverviewList);

// ✅ SUMMARY (cards এর জন্য)
router.get("/summary", InventoryOverviewController.getInventoryOverviewSummary);

module.exports = router;
