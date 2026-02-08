// app/modules/overview/overview.service.js

const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

// ✅ তোমার প্রকৃত model নাম অনুযায়ী নিচের নামগুলো ঠিক করে বসাবে
const AssetsSale = db.assetsSale; // or db.sale
const AssetsPurchase = db.assetsPurchase; // or db.purchase
const AssetsDamage = db.assetsDamage; // or db.purchase
const Marketing = db.meta; // or db.meta
const Receiveable = db.receiveable;
const Payable = db.payable;

const ReceivedProduct = db.receivedProduct;
const PurchaseReturnProduct = db.purchaseReturnProduct;
const InTransitProduct = db.inTransitProduct;
const ReturnProduct = db.returnProduct; // sales return
const DamageProduct = db.damageProduct;

const CashInOut = db.cashInOut;

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

const getOverviewSummaryFromDB = async (filters) => {
  const { from, to } = filters;
  const dateWhere = buildDateWhere(from, to);

  // ✅ Parallel queries (fast)
  const [
    totalMetaAmount,
    totalReceiveableAmount,
    totalPayableAmount,

    totalPurchaseAmount,
    totalSaleAmount,
    totalDamageAmount,

    totalReceivedProductAmount,
    totalPurchaseReturnProductAmount,
    totalIntransitProductAmount,
    totalSalesReturnProductAmount,
    totalDamageProductProductAmount,

    totalCashInAmount,
    totalCashOutAmount,
  ] = await Promise.all([
    // Marketing
    sumField(Marketing, "amount", dateWhere),

    // Receiveable / Payable
    sumField(Receiveable, "amount", dateWhere),
    sumField(Payable, "amount", dateWhere),

    // Assets Purchase / Sale
    sumField(AssetsPurchase, "quantity", dateWhere),
    sumField(AssetsSale, "quantity", dateWhere),
    sumField(AssetsDamage, "quantity", dateWhere),

    // Inventory
    sumField(ReceivedProduct, "quantity", dateWhere),
    sumField(PurchaseReturnProduct, "quantity", dateWhere),
    sumField(InTransitProduct, "quantity", dateWhere),
    sumField(ReturnProduct, "quantity", dateWhere),
    sumField(DamageProduct, "quantity", dateWhere),

    // Cash In/Out (same table, different status)
    sumField(CashInOut, "amount", { ...dateWhere, paymentStatus: "CashIn" }),
    sumField(CashInOut, "amount", { ...dateWhere, paymentStatus: "CashOut" }),
  ]);

  // ✅ তোমার UI logic অনুযায়ী হিসাব
  const remainingAmount = n(
    totalPurchaseAmount - (totalSaleAmount + totalDamageAmount),
  );

  const totalInventoryExpense = n(
    totalPurchaseReturnProductAmount +
      totalIntransitProductAmount +
      totalDamageProductProductAmount,
  );

  const inventoryStock_AfterAdd_SalesReturnProduct = n(
    totalReceivedProductAmount + totalSalesReturnProductAmount,
  );

  const remainingInventoryStock_AfterMinus_InventoryExpense = n(
    inventoryStock_AfterAdd_SalesReturnProduct - totalInventoryExpense,
  );

  return {
    // filters echo (optional)
    from: from || null,
    to: to || null,

    // Assets
    totalPurchaseAmount,
    totalSaleAmount,
    remainingAmount,

    // Inventory
    totalReceivedProductAmount,
    totalPurchaseReturnProductAmount,
    totalIntransitProductAmount,
    totalSalesReturnProductAmount,
    totalDamageProductProductAmount,
    remainingInventoryStock_AfterMinus_InventoryExpense,

    // Expenses & Accounts
    totalMetaAmount,
    totalReceiveableAmount,
    totalPayableAmount,

    // Cash
    totalCashInAmount,
    totalCashOutAmount,
  };
};

const OverviewService = {
  getOverviewSummaryFromDB,
};

module.exports = OverviewService;
