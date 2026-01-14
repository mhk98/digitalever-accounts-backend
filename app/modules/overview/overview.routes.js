// app/modules/overview/overview.routes.js

const router = require("express").Router();
const OverviewController = require("./overview.controller");

// GET /api/v1/overview/summary?from=2026-01-01&to=2026-01-13
router.get("/summary", OverviewController.getOverviewSummaryFromDB);

const OverviewRoutes = router;
module.exports = OverviewRoutes;
