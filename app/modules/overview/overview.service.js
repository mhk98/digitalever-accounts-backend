// app/modules/overview/overview.service.js

const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const Receiveable = db.receiveable;
const Payable = db.payable;
const PurchaseRequisition = db.purchaseRequisition;
const PettyCashRequisition = db.pettyCashRequisition;
const AssetsRequisition = db.assetsRequisition;
const DamageStock = db.damageStock;
const DamageReparingStock = db.damageReparingStock;
const AssetsStock = db.assetsStock;
const CashInOut = db.cashInOut;
const InventoryMaster = db.inventoryMaster;
const ConfirmOrder = db.confirmOrder;
const MarketingExpense = db.marketingExpense;

// ✅ helper: safe number
const n = (v) => Number(v || 0);

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isTruthyFilterFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;

  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
};

const normalizeDateFilters = (filters = {}) => {
  const filterType =
    filters.filterType || filters.filter || filters.preset || null;
  const normalizedFilterType = filterType
    ? String(filterType).trim().toLowerCase()
    : null;
  const date = filters.date || null;
  const customFrom = filters.from || filters.startDate || null;
  const customTo = filters.to || filters.endDate || null;
  const explicitFilterRequested =
    normalizedFilterType === "today" ||
    normalizedFilterType === "thismonth" ||
    normalizedFilterType === "this_month" ||
    normalizedFilterType === "custom" ||
    isTruthyFilterFlag(filters.applyFilter) ||
    isTruthyFilterFlag(filters.hasDateFilter) ||
    isTruthyFilterFlag(filters.isFiltered);

  let from = null;
  let to = null;

  if (normalizedFilterType === "today") {
    const today = formatDateOnly(new Date());
    from = today;
    to = today;
  }

  if (
    normalizedFilterType === "thismonth" ||
    normalizedFilterType === "this_month"
  ) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    from = formatDateOnly(firstDay);
    to = formatDateOnly(lastDay);
  }

  if (date && explicitFilterRequested) {
    return {
      from: date,
      to: date,
      filterType: normalizedFilterType || "custom",
    };
  }

  if (
    explicitFilterRequested &&
    normalizedFilterType !== "today" &&
    normalizedFilterType !== "thismonth" &&
    normalizedFilterType !== "this_month"
  ) {
    from = customFrom;
    to = customTo;
  }

  return {
    from,
    to,
    filterType: from || to ? normalizedFilterType || "custom" : null,
  };
};

const normalizeDateValue = (value) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "Invalid date format. Use YYYY-MM-DD");
  }

  return parsed.toISOString().slice(0, 10);
};

const parseBoundaryDateTime = (value, edge) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "Invalid date format. Use YYYY-MM-DD");
  }

  if (edge === "start") {
    parsed.setHours(0, 0, 0, 0);
  } else {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
};

// ✅ helper: date range where builder
const buildDateWhere = (from, to, field = "createdAt") => {
  if (!from && !to) return {};

  const isDateOnlyField = field === "date";

  if (from && to) {
    return {
      [field]: {
        [Op.between]: isDateOnlyField
          ? [normalizeDateValue(from), normalizeDateValue(to)]
          : [
              parseBoundaryDateTime(from, "start"),
              parseBoundaryDateTime(to, "end"),
            ],
      },
    };
  }

  if (from) {
    return {
      [field]: {
        [Op.gte]: isDateOnlyField
          ? normalizeDateValue(from)
          : parseBoundaryDateTime(from, "start"),
      },
    };
  }

  return {
    [field]: {
      [Op.lte]: isDateOnlyField
        ? normalizeDateValue(to)
        : parseBoundaryDateTime(to, "end"),
    },
  };
};

const sumField = async (Model, field, where = {}) => {
  if (!Model) return 0;
  const total = await Model.sum(field, {
    where,
    paranoid: true,
  });
  return n(total);
};

const countWhere = async (Model, where = {}) => {
  if (!Model) return 0;
  return n(
    await Model.count({
      where,
      paranoid: true,
    }),
  );
};

const sumQuantityValue = async (
  Model,
  where = {},
  priceField = "purchase_price",
) => {
  if (!Model) return 0;

  const result = await Model.findOne({
    where,
    paranoid: true,
    attributes: [
      [
        db.Sequelize.fn(
          "COALESCE",
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.literal(`quantity * ${priceField}`),
          ),
          0,
        ),
        "totalValue",
      ],
    ],
    raw: true,
  });

  return n(result?.totalValue);
};

const getOverviewSummaryFromDB = async (filters) => {
  const { from, to, filterType } = normalizeDateFilters(filters);
  const transactionDateWhere = buildDateWhere(from, to, "date");
  const snapshotWhere = buildDateWhere(from, to, "createdAt");

  const [
    totalMetaAmount,
    totalAssetsBalance,
    totalReceiveableAmount,
    totalPayableAmount,
    totalInventoryOverview,
    totalInventoryRetailValue,
    totalDamageStockPrice,
    totalRepairingStockPrice,
    totalCashInAmount,
    totalCashOutAmount,
    grossSalesAmount,
    lowStockCount,
    pendingPurchaseRequisitionCount,
    pendingPettyCashRequisitionCount,
    pendingAssetsRequisitionCount,
  ] = await Promise.all([
    sumField(MarketingExpense, "amount", {
      ...transactionDateWhere,
      paymentStatus: "CashOut",
    }),
    sumQuantityValue(AssetsStock, snapshotWhere, "price"),
    sumField(Receiveable, "amount", transactionDateWhere),
    sumField(Payable, "amount", transactionDateWhere),
    sumQuantityValue(InventoryMaster, snapshotWhere, "purchase_price"),
    sumQuantityValue(InventoryMaster, snapshotWhere, "sale_price"),
    sumField(DamageStock, "purchase_price", transactionDateWhere),
    sumField(DamageReparingStock, "purchase_price", transactionDateWhere),
    sumField(CashInOut, "amount", {
      ...transactionDateWhere,
      paymentStatus: "CashIn",
    }),
    sumField(CashInOut, "amount", {
      ...transactionDateWhere,
      paymentStatus: "CashOut",
    }),
    sumField(ConfirmOrder, "sale_price", transactionDateWhere),
    countWhere(InventoryMaster, {
      ...snapshotWhere,
      quantity: { [Op.lt]: 10 },
    }),
    countWhere(PurchaseRequisition, {
      ...transactionDateWhere,
      status: "Pending",
    }),
    countWhere(PettyCashRequisition, {
      ...transactionDateWhere,
      status: "Pending",
    }),
    countWhere(AssetsRequisition, {
      ...transactionDateWhere,
      status: "Pending",
    }),
  ]);

  const netCashPosition = n(totalCashInAmount - totalCashOutAmount);
  const totalPendingApprovalCount = n(
    pendingPurchaseRequisitionCount +
      pendingPettyCashRequisitionCount +
      pendingAssetsRequisitionCount,
  );

  return {
    filterType,
    from: from || null,
    to: to || null,
    totalMetaAmount,
    totalAssetsBalance,
    totalReceiveableAmount,
    totalPayableAmount,
    totalInventoryOverview,
    totalInventoryRetailValue,
    totalDamageStockPrice,
    totalRepairingStockPrice,
    grossSalesAmount,
    totalCashInAmount,
    totalCashOutAmount,
    netCashPosition,
    lowStockCount,
    pendingPurchaseRequisitionCount,
    pendingPettyCashRequisitionCount,
    pendingAssetsRequisitionCount,
    totalPendingApprovalCount,
  };
};

const OverviewService = {
  getOverviewSummaryFromDB,
};

module.exports = OverviewService;
