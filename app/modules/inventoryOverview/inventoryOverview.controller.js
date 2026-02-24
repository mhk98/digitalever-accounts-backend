// app/modules/InventoryOverview/InventoryOverview.controller.js

const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const {
  InventoryOverviewFilterAbleFileds,
} = require("./inventoryOverview.constants");
const InventoryOverviewService = require("./inventoryOverview.service");

const getInventoryOverviewSummaryFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, InventoryOverviewFilterAbleFileds);

  const result =
    await InventoryOverviewService.getInventoryOverviewSummaryFromDB(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "InventoryOverview summary fetched!!",
    data: result,
  });
});

const InventoryOverviewController = {
  getInventoryOverviewSummaryFromDB,
};

module.exports = InventoryOverviewController;
