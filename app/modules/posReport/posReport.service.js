const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { PosReportSearchableFields } = require("./posReport.constants");
const PosReport = db.posReport;
const ReceivedProduct = db.receivedProduct;
const Notification = db.notification;
const User = db.user;
const WarrantyProduct = db.warrantyProduct;

// const insertIntoDB = async (data) => {
//   const {
//     name,
//     date,
//     note,
//     amount,
//     mobile,
//     address,
//     status,
//     quantity,
//     userId,
//     productId,
//   } = data;

//   console.log("InTransit", data);

//   const returnQty = Number(quantity);
//   const rid = Number(productId);

//   if (!rid) throw new ApiError(400, "productId is required");
//   if (!returnQty || returnQty <= 0) {
//     throw new ApiError(400, "Quantity must be greater than 0");
//   }

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

//   // ✅ Approved হলে পুরোনো date-ও allow + save
//   const isApproved = String(status || "").trim() === "Approved";

//   // ✅ current date না হলে auto Pending
//   const finalStatus = isApproved
//     ? "Approved"
//     : inputDateStr !== todayStr
//       ? "Pending"
//       : null;

//   return await db.sequelize.transaction(async (t) => {
//     const received = await ReceivedProduct.findOne({
//       where: { Id: rid },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!received) throw new ApiError(404, "Received product not found");

//     const oldQty = Number(received.quantity || 0);
//     if (oldQty < returnQty) {
//       throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
//     }

//     const perUnitPurchase =
//       oldQty > 0 ? Number(received.purchase_price || 0) / oldQty : 0;
//     const perUnitSale =
//       oldQty > 0 ? Number(received.sale_price || 0) / oldQty : 0;

//     const deductPurchase = perUnitPurchase * returnQty;
//     const deductSale = perUnitSale * returnQty;

//     const realProductId = Number(received.productId);
//     if (!realProductId) {
//       throw new ApiError(
//         400,
//         "ReceivedProduct.productId missing (Products.Id)",
//       );
//     }

//     const result = await PosReport.create(
//       {
//         name,
//         quantity: returnQty,
//         price,
//         productId: realProductId, // ✅ Products.Id (FK)
//         status: finalStatus || "---",
//         note: note || "---",
//         date: date,
//         amount,
//         mobile,
//         address,
//       },
//       { transaction: t },
//     );

//     await ReceivedProduct.update(
//       {
//         quantity: oldQty - returnQty,
//         purchase_price: Math.max(
//           0,
//           Number(received.purchase_price || 0) - deductPurchase,
//         ),
//         sale_price: Math.max(0, Number(received.sale_price || 0) - deductSale),
//       },
//       { where: { Id: received.Id }, transaction: t },
//     );

//     const users = await User.findAll({
//       attributes: ["Id", "role"],
//       where: {
//         Id: { [Op.ne]: userId },
//         role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
//       },
//     });

//     if (users.length) {
//       const message =
//         status === "Approved"
//           ? "Received product request approved"
//           : note || "Please approved my request";

//       await Promise.all(
//         users.map((u) =>
//           Notification.create({
//             userId: u.Id,
//             message,
//             url: "/purchase-requisition",
//           }),
//         ),
//       );
//     }

//     return result;
//   });
// };

// const insertIntoDB = async (payload) => {
//   const {
//     name,
//     date,
//     note,
//     mobile,
//     address,
//     subTotal,
//     discount,
//     deliveryCharge,
//     total,
//     paidAmount,
//     // dueAmount,
//     warrantyValue,
//     warrantyUnit,
//     status,
//     items,
//   } = payload || {};

//   console.log("pos", payload);

//   if (!name) throw new ApiError(400, "Customer name is required");
//   if (!date) throw new ApiError(400, "Sell date is required");
//   if (!Array.isArray(items) || items.length === 0)
//     throw new ApiError(400, "Items are required");

//   // Basic sanitize
//   const finalPaid = Number(paidAmount) || 0;
//   const finalTotal = Number(total) || 0;
//   const finalDue = Math.max(0, finalTotal - finalPaid);

//   const finalStatus =
//     String(status || "").trim() || (finalDue > 0 ? "DUE" : "PAID");

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

//   // ✅ Approved হলে পুরোনো date-ও allow + save
//   const isApproved = String(status || "").trim() === "Approved";

//   // ✅ current date না হলে auto Pending
//   const warrantyProductStatus = isApproved
//     ? "Approved"
//     : inputDateStr !== todayStr
//       ? "Pending"
//       : null;

//   return await db.sequelize.transaction(async (t) => {
//     // ✅ 1) Stock check + deduct
//     for (const it of items) {
//       const rid = Number(it.Id);
//       const qty = Number(it.qty);

//       if (!rid) throw new ApiError(400, "received_product_id is required");
//       if (!qty || qty <= 0) throw new ApiError(400, "qty must be > 0");

//       const received = await ReceivedProduct.findOne({
//         where: { Id: rid },
//         transaction: t,
//         lock: t.LOCK.UPDATE,
//       });

//       if (!received)
//         throw new ApiError(404, `Received product not found: ${rid}`);

//       const oldQty = Number(received.quantity || 0);
//       if (oldQty < qty) {
//         throw new ApiError(
//           400,
//           `Not enough stock for received_product_id=${rid}. Available: ${oldQty}`,
//         );
//       }

//       // ✅ quantity কমানো
//       await ReceivedProduct.update(
//         { quantity: oldQty - qty },
//         { where: { Id: received.Id }, transaction: t },
//       );

//       // (Optional) যদি purchase_price/sale_price total হিসাব করে রাখো, এখানে pro-rate করে কমাতে পারো
//       // কিন্তু safest: শুধু quantity কমাও, price totals অন্যভাবে handle করো।
//     }

//     // ✅ 2) PosReport create (items JSON সহ)
//     const result = await PosReport.create(
//       {
//         name,
//         date,
//         note: note || null,
//         mobile: mobile || null,
//         address: address || null,

//         subTotal: Number(subTotal) || 0,
//         discount: Number(discount) || 0,
//         deliveryCharge: Number(deliveryCharge) || 0,
//         total: finalTotal,
//         paidAmount: finalPaid,
//         dueAmount: finalDue,

//         status: finalStatus,
//         amount: finalPaid, // ✅ যদি amount বলতে paidAmount বুঝাও
//         items, // ✅ JSON 그대로 save হবে
//       },
//       { transaction: t },
//     );

//     if (result) {
//       await WarrantyProduct.create({
//         name: name,
//         quantity,
//         price,
//         date: date,
//         warrantyValue,
//         warrantyUnit,
//       });
//     }

//     return result;
//   });
// };

const insertIntoDB = async (payload) => {
  const {
    name,
    date,
    note,
    mobile,
    address,
    subTotal,
    discount,
    deliveryCharge,
    total,
    paidAmount,
    warrantyValue,
    warrantyUnit,
    status,
    items,
  } = payload || {};

  if (!name) throw new ApiError(400, "Customer name is required");
  if (!date) throw new ApiError(400, "Sell date is required");
  if (!Array.isArray(items) || items.length === 0)
    throw new ApiError(400, "Items are required");

  const finalPaid = Number(paidAmount) || 0;
  const finalTotal = Number(total) || 0;
  const finalDue = Math.max(0, finalTotal - finalPaid);

  const finalStatus =
    String(status || "").trim() || (finalDue > 0 ? "DUE" : "PAID");

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  const isApproved = String(status || "").trim() === "Approved";

  const warrantyProductStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : null;

  return await db.sequelize.transaction(async (t) => {
    // ✅ 1) Stock check + deduct
    for (const it of items) {
      const rid = Number(it.Id);
      const qty = Number(it.qty);

      if (!rid) throw new ApiError(400, "received_product_id is required");
      if (!qty || qty <= 0) throw new ApiError(400, "qty must be > 0");

      const received = await ReceivedProduct.findOne({
        where: { Id: rid },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!received)
        throw new ApiError(404, `Received product not found: ${rid}`);

      const oldQty = Number(received.quantity || 0);
      if (oldQty < qty) {
        throw new ApiError(
          400,
          `Not enough stock for received_product_id=${rid}. Available: ${oldQty}`,
        );
      }

      await ReceivedProduct.update(
        { quantity: oldQty - qty },
        { where: { Id: received.Id }, transaction: t },
      );
    }

    // ✅ 2) PosReport create
    const result = await PosReport.create(
      {
        name,
        date,
        note: note || null,
        mobile: mobile || null,
        address: address || null,

        subTotal: Number(subTotal) || 0,
        discount: Number(discount) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        total: finalTotal,
        paidAmount: finalPaid,
        dueAmount: finalDue,

        status: finalStatus,
        amount: finalPaid,
        items,
      },
      { transaction: t },
    );

    // ✅ 3) WarrantyProduct insert from items
    // warranty না থাকলে skip করতে চাইলে এই guard টা রাখো
    if (Number(warrantyValue) > 0 && warrantyUnit) {
      const warrantyRows = [];

      for (const it of items) {
        const qty = Number(it.qty) || 0;
        const unitPrice = Number(it.price) || 0;
        const itemName = (it.name && String(it.name).trim()) || "N/A"; // fallback

        if (qty <= 0) continue;

        warrantyRows.push({
          name: itemName,
          quantity: qty,
          price: unitPrice * qty, // ✅ total price
          date: date,
          warrantyValue: Number(warrantyValue) || 0,
          warrantyUnit: warrantyUnit || null,
        });
      }

      if (warrantyRows.length) {
        await WarrantyProduct.bulkCreate(warrantyRows, { transaction: t });
      }
    }

    return result;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: PosReportSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range filter (createdAt)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await PosReport.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await PosReport.count({ where: whereConditions });

  // // ✅ total count + total quantity (same filters)
  // const [count, totalQuantity] = await Promise.all([
  //   PosReport.count({ where: whereConditions }),
  //   PosReport.sum("quantity", { where: whereConditions }),
  // ]);

  return {
    meta: { page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await PosReport.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await PosReport.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");

    const qty = Number(ret.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    // 2) ReceivedProduct খুঁজে বের করো (Products.Id দিয়ে)
    const received = await ReceivedProduct.findOne({
      where: { productId: ret.productId }, // ✅ Products.Id
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) throw new ApiError(404, "Received product not found");

    // 3) stock ফিরিয়ে দাও
    await ReceivedProduct.update(
      {
        quantity: Number(received.quantity || 0) + qty,
        purchase_price:
          Number(received.purchase_price || 0) +
          Number(ret.purchase_price || 0),
        sale_price:
          Number(received.sale_price || 0) + Number(ret.sale_price || 0),
      },
      { where: { Id: received.Id }, transaction: t },
    );

    // 4) Return row delete
    await PosReport.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

// const updateOneFromDB = async (id, data) => {
//   const { quantity, receivedId, note, status, userId } = data;

//   console.log("InTransit", data);

//   const returnQty = Number(quantity);
//   const rid = Number(receivedId);

//   if (!rid) throw new ApiError(400, "receivedId is required");
//   if (!returnQty || returnQty <= 0) {
//     throw new ApiError(400, "Quantity must be greater than 0");
//   }

//   return await db.sequelize.transaction(async (t) => {
//     const received = await ReceivedProduct.findOne({
//       where: { Id: rid },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!received) throw new ApiError(404, "Received product not found");

//     const oldQty = Number(received.quantity || 0);
//     if (oldQty < returnQty) {
//       throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
//     }

//     const perUnitPurchase =
//       oldQty > 0 ? Number(received.purchase_price || 0) / oldQty : 0;
//     const perUnitSale =
//       oldQty > 0 ? Number(received.sale_price || 0) / oldQty : 0;

//     const deductPurchase = perUnitPurchase * returnQty;
//     const deductSale = perUnitSale * returnQty;

//     const realProductId = Number(received.productId);
//     if (!realProductId) {
//       throw new ApiError(
//         400,
//         "ReceivedProduct.productId missing (Products.Id)",
//       );
//     }

//     const [updatedCount] = await PosReport.update(
//       {
//         name: received.name,
//         supplier: received.supplier,
//         quantity: returnQty,
//         purchase_price: deductPurchase,
//         note: status === "Approved" ? "---" : note,
//         status: status ? status : "Pending",
//         sale_price: deductSale,
//         productId: realProductId, // ✅ Products.Id (FK)
//       },
//       {
//         where: { Id: id },
//         transaction: t,
//       },
//     );

//     if (status === "Approved") {
//       await ReceivedProduct.update(
//         {
//           quantity: oldQty - returnQty,
//           purchase_price: Math.max(
//             0,
//             Number(received.purchase_price || 0) - deductPurchase,
//           ),
//           sale_price: Math.max(
//             0,
//             Number(received.sale_price || 0) - deductSale,
//           ),
//         },
//         { where: { Id: received.Id }, transaction: t },
//       );
//     }

//     const users = await User.findAll({
//       attributes: ["Id", "role"],
//       where: {
//         Id: { [Op.ne]: userId }, // sender বাদ
//         role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
//       },
//     });

//     console.log("users", users.length);
//     if (!users.length) return updatedCount;

//     const message =
//       finalStatus === "Approved"
//         ? "Intransit product request approved"
//         : finalNote || "Intransit product updated";

//     await Promise.all(
//       users.map((u) =>
//         Notification.create({
//           userId: u.Id,
//           message,
//           url: `/apikafela.digitalever.com.bd/intransit-product`,
//         }),
//       ),
//     );
//     return updatedCount;
//   });
// };

const updateOneFromDB = async (data) => {
  const {
    name,
    date,
    note,
    amount,
    mobile,
    address,
    status,
    quantity,
    userId,
    productId,
  } = data;

  console.log("InTransit", data);

  const returnQty = Number(quantity);
  const rid = Number(productId);

  if (!rid) throw new ApiError(400, "productId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  // ✅ Approved হলে পুরোনো date-ও allow + save
  const isApproved = String(status || "").trim() === "Approved";

  // ✅ current date না হলে auto Pending
  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : null;

  return await db.sequelize.transaction(async (t) => {
    const received = await ReceivedProduct.findOne({
      where: { Id: rid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) throw new ApiError(404, "Received product not found");

    const oldQty = Number(received.quantity || 0);
    if (oldQty < returnQty) {
      throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
    }

    const perUnitPurchase =
      oldQty > 0 ? Number(received.purchase_price || 0) / oldQty : 0;
    const perUnitSale =
      oldQty > 0 ? Number(received.sale_price || 0) / oldQty : 0;

    const deductPurchase = perUnitPurchase * returnQty;
    const deductSale = perUnitSale * returnQty;

    const realProductId = Number(received.productId);
    if (!realProductId) {
      throw new ApiError(
        400,
        "ReceivedProduct.productId missing (Products.Id)",
      );
    }

    const result = await PosReport.update(
      {
        name,
        quantity: returnQty,
        price,
        productId: realProductId, // ✅ Products.Id (FK)
        status: finalStatus || "---",
        note: note || "---",
        date: date,
        amount,
        mobile,
        address,
      },
      { transaction: t },
    );

    await ReceivedProduct.update(
      {
        quantity: oldQty - returnQty,
        purchase_price: Math.max(
          0,
          Number(received.purchase_price || 0) - deductPurchase,
        ),
        sale_price: Math.max(0, Number(received.sale_price || 0) - deductSale),
      },
      { where: { Id: received.Id }, transaction: t },
    );

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
    });

    if (users.length) {
      const message =
        status === "Approved"
          ? "Received product request approved"
          : note || "Please approved my request";

      await Promise.all(
        users.map((u) =>
          Notification.create({
            userId: u.Id,
            message,
            url: "/purchase-requisition",
          }),
        ),
      );
    }

    return result;
  });
};
const getAllFromDBWithoutQuery = async () => {
  const result = await PosReport.findAll();

  return result;
};

const PosReportService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PosReportService;
