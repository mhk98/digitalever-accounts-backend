// app/modules/InventoryOverview/InventoryOverview.service.js

const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const ReceivedProduct = db.receivedProduct;
const PurchaseReturnProduct = db.purchaseReturnProduct;
const InTransitProduct = db.inTransitProduct;
const ReturnProduct = db.returnProduct; // sales return
const ConfirmOrder = db.confirmOrder; // sales return
const DamageProduct = db.damageProduct;
const DamageRepair = db.damageRepair;
const DamageRepaired = db.damageRepaired;

// ✅ helper: safe number
const n = (v) => Number(v || 0);

// ✅ helper: date range where builder
const buildDateWhere = (from, to) => {
  if (!from && !to) return {};

  // যদি একটাই পাঠায়, error দিবো (optional)
  if (!from || !to) {
    throw new ApiError(400, "from এবং to দুইটাই দিতে হবে (YYYY-MM-DD)");
  }

  // server timezone based date boundary
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);

  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  return {
    date: { [Op.between]: [start, end] },
  };
};

const sumField = async (Model, field, where = {}) => {
  if (!Model) return 0;
  const total = await Model.sum(field, { where });
  return n(total);
};

const getInventoryOverviewSummaryFromDB = async (filters) => {
  const { from, to } = filters;
  const dateWhere = buildDateWhere(from, to);

  // ✅ Parallel queries (fast)
  const [
    totalReceivedProduct,
    totalPurchaseReturnProduct,
    totalIntransitProduct,
    totalSalesReturnProduct,
    totalConfirmOrder,
    totalDamageProduct,
    totalDamageRepair,
    totalDamageRepaired,
  ] = await Promise.all([
    // Inventory
    sumField(ReceivedProduct, "quantity", dateWhere),
    sumField(PurchaseReturnProduct, "quantity", dateWhere),
    sumField(InTransitProduct, "quantity", dateWhere),
    sumField(ReturnProduct, "quantity", dateWhere),
    sumField(ConfirmOrder, "quantity", dateWhere),
    sumField(DamageProduct, "quantity", dateWhere),
    sumField(DamageRepair, "quantity", dateWhere),
    sumField(DamageRepaired, "quantity", dateWhere),
  ]);

  return {
    // filters echo (optional)
    from: from || null,
    to: to || null,

    totalReceivedProduct,
    totalPurchaseReturnProduct,
    totalIntransitProduct,
    totalSalesReturnProduct,
    totalConfirmOrder,
    totalDamageProduct,
    totalDamageRepair,
    totalDamageRepaired,
  };
};

const InventoryOverviewService = {
  getInventoryOverviewSummaryFromDB,
};

module.exports = InventoryOverviewService;
