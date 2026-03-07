// // // app/modules/InventoryOverview/InventoryOverview.service.js

// // const { Op } = require("sequelize");
// // const db = require("../../../models");
// // const ApiError = require("../../../error/ApiError");

// // const ReceivedProduct = db.receivedProduct;
// // const PurchaseReturnProduct = db.purchaseReturnProduct;
// // const InTransitProduct = db.inTransitProduct;
// // const ReturnProduct = db.returnProduct; // sales return
// // const ConfirmOrder = db.confirmOrder; // sales return
// // const DamageProduct = db.damageProduct;
// // const DamageRepair = db.damageRepair;
// // const DamageRepaired = db.damageRepaired;

// // // ✅ helper: safe number
// // const n = (v) => Number(v || 0);

// // // ✅ helper: date range where builder
// // const buildDateWhere = (from, to) => {
// //   if (!from && !to) return {};

// //   // যদি একটাই পাঠায়, error দিবো (optional)
// //   if (!from || !to) {
// //     throw new ApiError(400, "from এবং to দুইটাই দিতে হবে (YYYY-MM-DD)");
// //   }

// //   // server timezone based date boundary
// //   const start = new Date(from);
// //   start.setHours(0, 0, 0, 0);

// //   const end = new Date(to);
// //   end.setHours(23, 59, 59, 999);

// //   return {
// //     date: { [Op.between]: [start, end] },
// //   };
// // };

// // const sumField = async (Model, field, where = {}) => {
// //   if (!Model) return 0;
// //   const total = await Model.sum(field, { where });
// //   return n(total);
// // };

// // const getInventoryOverviewSummaryFromDB = async (filters) => {
// //   const { from, to } = filters;
// //   const dateWhere = buildDateWhere(from, to);

// //   // ✅ Parallel queries (fast)
// //   const [
// //     totalReceivedProduct,
// //     totalPurchaseReturnProduct,
// //     totalIntransitProduct,
// //     totalSalesReturnProduct,
// //     totalConfirmOrder,
// //     totalDamageProduct,
// //     totalDamageRepair,
// //     totalDamageRepaired,
// //   ] = await Promise.all([
// //     // Inventory
// //     sumField(ReceivedProduct, "quantity", dateWhere),
// //     sumField(PurchaseReturnProduct, "quantity", dateWhere),
// //     sumField(InTransitProduct, "quantity", dateWhere),
// //     sumField(ReturnProduct, "quantity", dateWhere),
// //     sumField(ConfirmOrder, "quantity", dateWhere),
// //     sumField(DamageProduct, "quantity", dateWhere),
// //     sumField(DamageRepair, "quantity", dateWhere),
// //     sumField(DamageRepaired, "quantity", dateWhere),
// //   ]);

// //   return {
// //     // filters echo (optional)
// //     from: from || null,
// //     to: to || null,

// //     totalReceivedProduct,
// //     totalPurchaseReturnProduct,
// //     totalIntransitProduct,
// //     totalSalesReturnProduct,
// //     totalConfirmOrder,
// //     totalDamageProduct,
// //     totalDamageRepair,
// //     totalDamageRepaired,
// //   };
// // };

// // const InventoryOverviewService = {
// //   getInventoryOverviewSummaryFromDB,
// // };

// // module.exports = InventoryOverviewService;

// // app/modules/InventoryOverview/InventoryOverview.service.js

// const { Op } = require("sequelize");
// const db = require("../../../models");
// const ApiError = require("../../../error/ApiError");

// const ReceivedProduct = db.receivedProduct;
// const PurchaseReturnProduct = db.purchaseReturnProduct;
// const InTransitProduct = db.inTransitProduct;
// const ReturnProduct = db.returnProduct; // sales return
// const ConfirmOrder = db.confirmOrder;
// const DamageProduct = db.damageProduct;
// const DamageRepair = db.damageRepair;
// const DamageRepaired = db.damageRepaired;

// // ✅ helper: safe number
// const n = (v) => Number(v || 0);

// // ✅ helper: date where (optional)
// const buildDateWhere = (from, to) => {
//   if (!from && !to) return {};

//   // আপনি চাইলে strict রাখতে পারেন; আমি strict রেখেছি
//   if (!from || !to) {
//     throw new ApiError(400, "from এবং to দুইটাই দিতে হবে (YYYY-MM-DD)");
//   }

//   const start = new Date(from);
//   start.setHours(0, 0, 0, 0);

//   const end = new Date(to);
//   end.setHours(23, 59, 59, 999);

//   return { date: { [Op.between]: [start, end] } };
// };

// // ✅ helper: name where (optional)
// const buildNameWhere = (name) => {
//   if (!name) return {};
//   return {
//     name: {
//       [Op.like]: `%${String(name).trim()}%`,
//     },
//   };
// };

// // ✅ list fetcher
// const findRows = async (Model, where = {}, label) => {
//   if (!Model) return [];

//   const rows = await Model.findAll({
//     where,
//     attributes: ["Id", "name", "quantity", "date"],
//     order: [
//       ["date", "DESC"],
//       ["Id", "DESC"],
//     ],
//   });

//   // label সহ চাইলে source add করে দিতে পারেন
//   return rows.map((r) => ({
//     source: label, // কোন টেবিল থেকে এসেছে বুঝতে সুবিধা হবে
//     Id: r.Id,
//     name: r.name,
//     quantity: n(r.quantity),
//     date: r.date,
//   }));
// };

// // ✅ old summary helper (optional)
// const sumField = async (Model, field, where = {}) => {
//   if (!Model) return 0;
//   const total = await Model.sum(field, { where });
//   return n(total);
// };

// // ✅ NEW: List API (date + name filter, return rows)
// const getInventoryOverviewListFromDB = async (filters) => {
//   const { from, to, name } = filters;

//   const dateWhere = buildDateWhere(from, to);
//   const nameWhere = buildNameWhere(name);

//   const where = { ...dateWhere, ...nameWhere };

//   const [
//     received,
//     purchaseReturn,
//     intransit,
//     salesReturn,
//     confirmOrder,
//     damageProduct,
//     damageRepair,
//     damageRepaired,
//   ] = await Promise.all([
//     findRows(ReceivedProduct, where, "ReceivedProduct"),
//     findRows(PurchaseReturnProduct, where, "PurchaseReturnProduct"),
//     findRows(InTransitProduct, where, "InTransitProduct"),
//     findRows(ReturnProduct, where, "SalesReturnProduct"),
//     findRows(ConfirmOrder, where, "ConfirmOrder"),
//     findRows(DamageProduct, where, "DamageProduct"),
//     findRows(DamageRepair, where, "DamageRepair"),
//     findRows(DamageRepaired, where, "DamageRepaired"),
//   ]);

//   const data = [
//     ...received,
//     ...purchaseReturn,
//     ...intransit,
//     ...salesReturn,
//     ...confirmOrder,
//     ...damageProduct,
//     ...damageRepair,
//     ...damageRepaired,
//   ].sort((a, b) => {
//     const da = a.date ? new Date(a.date).getTime() : 0;
//     const dbb = b.date ? new Date(b.date).getTime() : 0;
//     if (dbb !== da) return dbb - da;
//     return (b.Id || 0) - (a.Id || 0);
//   });

//   return {
//     meta: {
//       from: from || null,
//       to: to || null,
//       name: name || null,
//       count: data.length,
//     },
//     data,
//   };
// };

// // ✅ OPTIONAL: Summary API আগের মতো রাখতে চাইলে
// const getInventoryOverviewSummaryFromDB = async (filters) => {
//   const { from, to } = filters;
//   const dateWhere = buildDateWhere(from, to);

//   const [
//     totalReceivedProduct,
//     totalPurchaseReturnProduct,
//     totalIntransitProduct,
//     totalSalesReturnProduct,
//     totalConfirmOrder,
//     totalDamageProduct,
//     totalDamageRepair,
//     totalDamageRepaired,
//   ] = await Promise.all([
//     sumField(ReceivedProduct, "quantity", dateWhere),
//     sumField(PurchaseReturnProduct, "quantity", dateWhere),
//     sumField(InTransitProduct, "quantity", dateWhere),
//     sumField(ReturnProduct, "quantity", dateWhere),
//     sumField(ConfirmOrder, "quantity", dateWhere),
//     sumField(DamageProduct, "quantity", dateWhere),
//     sumField(DamageRepair, "quantity", dateWhere),
//     sumField(DamageRepaired, "quantity", dateWhere),
//   ]);

//   return {
//     from: from || null,
//     to: to || null,
//     totalReceivedProduct,
//     totalPurchaseReturnProduct,
//     totalIntransitProduct,
//     totalSalesReturnProduct,
//     totalConfirmOrder,
//     totalDamageProduct,
//     totalDamageRepair,
//     totalDamageRepaired,
//   };
// };

// const InventoryOverviewService = {
//   // getInventoryOverviewListFromDB,
//   getInventoryOverviewSummaryFromDB, // optional
// };

// module.exports = InventoryOverviewService;

// app/modules/InventoryOverview/inventoryOverview.service.js

const { Op } = require("sequelize");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const ReceivedProduct = db.receivedProduct;
const PurchaseReturnProduct = db.purchaseReturnProduct;
const InTransitProduct = db.inTransitProduct;
const ReturnProduct = db.returnProduct;
const ConfirmOrder = db.confirmOrder;
const DamageProduct = db.damageProduct;
const DamageRepair = db.damageRepair;
const DamageRepaired = db.damageRepaired;

const n = (v) => Number(v || 0);

const buildDateWhere = (from, to) => {
  if (!from && !to) return {};

  // strict mode
  if (!from || !to) {
    throw new ApiError(400, "from এবং to দুইটাই দিতে হবে (YYYY-MM-DD)");
  }

  const start = new Date(from);
  start.setHours(0, 0, 0, 0);

  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  return { date: { [Op.between]: [start, end] } };
};

const buildNameWhere = (name) => {
  if (!name) return {};
  return {
    name: { [Op.like]: `%${String(name).trim()}%` },
  };
};

const findRows = async (Model, where = {}, label) => {
  const rows = await Model.findAll({
    where,
    attributes: ["Id", "name", "quantity", "date"],
    order: [
      ["date", "DESC"],
      ["Id", "DESC"],
    ],
  });

  return rows.map((r) => ({
    source: label,
    Id: r.Id,
    name: r.name,
    quantity: n(r.quantity),
    date: r.date,
  }));
};

// const getInventoryOverviewListFromDB = async (filters) => {
//   const { from, to, name } = filters;

//   const page = Math.max(1, Number(filters.page || 1));
//   const limit = Math.max(1, Number(filters.limit || 10));
//   const skip = (page - 1) * limit;

//   const where = {
//     ...buildDateWhere(from, to),
//     ...buildNameWhere(name),
//   };

//   const [
//     // received,
//     purchaseReturn,
//     intransit,
//     salesReturn,
//     confirmOrder,
//     damageProduct,
//     damageRepair,
//     damageRepaired,
//   ] = await Promise.all([
//     // findRows(ReceivedProduct, where, "Received Product"),
//     findRows(PurchaseReturnProduct, where, "Purchase Return Product"),
//     findRows(InTransitProduct, where, "In Transit Product"),
//     findRows(ReturnProduct, where, "Sales Return Product"),
//     findRows(ConfirmOrder, where, "Confirm Order"),
//     findRows(DamageProduct, where, "Damage Product"),
//     findRows(DamageRepair, where, "Damage Repair"),
//     findRows(DamageRepaired, where, "Damage Repaired"),
//   ]);

//   const all = [
//     // ...received,
//     ...purchaseReturn,
//     ...intransit,
//     ...salesReturn,
//     ...confirmOrder,
//     ...damageProduct,
//     ...damageRepair,
//     ...damageRepaired,
//   ].sort((a, b) => {
//     const da = a.date ? new Date(a.date).getTime() : 0;
//     const dbb = b.date ? new Date(b.date).getTime() : 0;
//     if (dbb !== da) return dbb - da;
//     return (b.Id || 0) - (a.Id || 0);
//   });

//   const paged = all.slice(skip, skip + limit);

//   return {
//     meta: {
//       from: from || null,
//       to: to || null,
//       name: name || null,
//       page,
//       limit,
//       count: all.length,
//       totalPages: Math.max(1, Math.ceil(all.length / limit)),
//     },
//     data: paged,
//   };
// };

// const getInventoryOverviewListFromDB = async (filters) => {
//   const { from, to, name, source } = filters;

//   const page = Math.max(1, Number(filters.page || 1));
//   const limit = Math.max(1, Number(filters.limit || 10));
//   const skip = (page - 1) * limit;

//   // Build the 'where' object based on filters
//   const where = {
//     ...buildDateWhere(from, to),
//     ...buildNameWhere(name),
//   };

//   // Add 'source' filter to 'where' if it's provided
//   if (source) {
//     where.source = source; // Assuming source is a column in your tables
//   }

//   const [
//     received,
//     purchaseReturn,
//     intransit,
//     salesReturn,
//     confirmOrder,
//     damageProduct,
//     damageRepair,
//     damageRepaired,
//   ] = await Promise.all([
//     findRows(ReceivedProduct, where, "Received Product"),
//     findRows(PurchaseReturnProduct, where, "Purchase Return Product"),
//     findRows(InTransitProduct, where, "In Transit Product"),
//     findRows(ReturnProduct, where, "Sales Return Product"),
//     findRows(ConfirmOrder, where, "Confirm Order"),
//     findRows(DamageProduct, where, "Damage Product"),
//     findRows(DamageRepair, where, "Damage Repair"),
//     findRows(DamageRepaired, where, "Damage Repaired"),
//   ]);

//   const all = [
//     ...received,
//     ...purchaseReturn,
//     ...intransit,
//     ...salesReturn,
//     ...confirmOrder,
//     ...damageProduct,
//     ...damageRepair,
//     ...damageRepaired,
//   ].sort((a, b) => {
//     const da = a.date ? new Date(a.date).getTime() : 0;
//     const dbb = b.date ? new Date(b.date).getTime() : 0;
//     if (dbb !== da) return dbb - da;
//     return (b.Id || 0) - (a.Id || 0);
//   });

//   // Pagination: Slice the data to fit the requested page and limit
//   const paged = all.slice(skip, skip + limit);

//   return {
//     meta: {
//       from: from || null,
//       to: to || null,
//       name: name || null,
//       source: source || null, // Return source in the meta
//       page,
//       limit,
//       count: all.length,
//       totalPages: Math.max(1, Math.ceil(all.length / limit)),
//     },
//     data: paged,
//   };
// };

const getInventoryOverviewListFromDB = async (filters) => {
  const { from, to, name, source } = filters; // category here

  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.max(1, Number(filters.limit || 10));
  const skip = (page - 1) * limit;

  // Build the 'where' object based on filters
  const where = {
    ...buildDateWhere(from, to),
    ...buildNameWhere(name),
  };

  // Add 'category' (source) filter to 'where' if it's provided
  if (source) {
    where.source = source; // Assuming 'source' is the category you are filtering
  }

  const [
    received,
    purchaseReturn,
    intransit,
    salesReturn,
    damageProduct,
    damageRepair,
    damageRepaired,
  ] = await Promise.all([
    findRows(ReceivedProduct, where, "Received Product"),
    findRows(PurchaseReturnProduct, where, "Purchase Return Product"),
    findRows(InTransitProduct, where, "In Transit Product"),
    findRows(ReturnProduct, where, "Sales Return Product"),
    findRows(DamageProduct, where, "Damage Product"),
    findRows(DamageRepair, where, "Damage Repair"),
    findRows(DamageRepaired, where, "Damage Repaired"),
  ]);

  const all = [
    received,
    ...purchaseReturn,
    ...intransit,
    ...salesReturn,
    ...damageProduct,
    ...damageRepair,
    ...damageRepaired,
  ].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const dbb = b.date ? new Date(b.date).getTime() : 0;
    if (dbb !== da) return dbb - da;
    return (b.Id || 0) - (a.Id || 0);
  });

  const paged = all.slice(skip, skip + limit);

  return {
    meta: {
      from: from || null,
      to: to || null,
      name: name || null,
      source: source || null, // Return category in the meta
      page,
      limit,
      count: all.length,
      totalPages: Math.max(1, Math.ceil(all.length / limit)),
    },
    data: paged,
  };
};
// summary (আগেরটা রাখতে চাইলে)
const sumField = async (Model, field, where = {}) => {
  const total = await Model.sum(field, { where });
  return n(total);
};

const getInventoryOverviewSummaryFromDB = async (filters) => {
  const { from, to } = filters;
  const dateWhere = buildDateWhere(from, to);

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

module.exports = {
  getInventoryOverviewListFromDB,
  getInventoryOverviewSummaryFromDB,
};
