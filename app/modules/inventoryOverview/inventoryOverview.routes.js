// app/modules/InventoryOverview/InventoryOverview.routes.js

const router = require("express").Router();
const InventoryOverviewController = require("./inventoryOverview.controller");

// GET /api/v1/InventoryOverview/summary?from=2026-01-01&to=2026-01-13
router.get(
  "/summary",
  InventoryOverviewController.getInventoryOverviewSummaryFromDB,
);

const InventoryOverviewRoutes = router;
module.exports = InventoryOverviewRoutes;
