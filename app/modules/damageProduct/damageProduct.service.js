const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { DamageProductSearchableFields } = require("./damageProduct.constants");
const DamageProduct = db.damageProduct;
const ReceivedProduct = db.receivedProduct;
const Notification = db.notification;
const User = db.user;

// const insertIntoDB = async (data) => {
//   const { quantity, productId } = data;

//   const qty = Number(quantity);

//   if (!qty || qty <= 0) {
//     throw new ApiError(400, "Quantity must be greater than 0");
//   }

//   return await db.sequelize.transaction(async (t) => {
//     // ✅ ReceivedProduct (stock)
//     // ⚠️ যদি তোমার ReceivedProduct এ productId নামে কলাম থাকে, তাহলে where: { productId } করবে
//     const received = await ReceivedProduct.findOne({
//       where: { Id: productId },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!received) throw new ApiError(404, "Received product not found");

//     // ✅ Stock check
//     const availableQty = Number(received.quantity);
//     if (availableQty < qty) {
//       throw new ApiError(400, `Not enough stock. Available: ${availableQty}`);
//     }

//     // ✅ Return amounts (per unit * qty)
//     const unitPurchase = Number(productData.purchase_price);
//     const unitSale = Number(productData.sale_price);

//     const returnPurchase = unitPurchase * qty;
//     const returnSale = unitSale * qty;

//     // ✅ Create Purchase Return row (store returned totals)
//     const payload = {
//       name: productData.name,
//       supplier: productData.supplier,
//       quantity: qty,
//       purchase_price: returnPurchase,
//       sale_price: returnSale,
//       productId,
//     };

//     const result = await DamageProduct.create(payload, {
//       transaction: t,
//     });

//     // ✅ Update ReceivedProduct (subtract qty & totals)
//     const newQty = availableQty - qty;

//     const newPurchaseTotal = Math.max(
//       0,
//       Number(received.purchase_price) - returnPurchase,
//     );

//     const newSaleTotal = Math.max(0, Number(received.sale_price) - returnSale);

//     await ReceivedProduct.update(
//       {
//         quantity: newQty,
//         purchase_price: newPurchaseTotal,
//         sale_price: newSaleTotal,
//       },
//       {
//         where: { Id: received.Id }, // যদি where: { productId } লাগে, এখানে বদলাবে
//         transaction: t,
//       },
//     );

//     return result;
//   });
// };

const insertIntoDB = async (data) => {
  const { quantity, receivedId, date, note, status, userId } = data;

  console.log("Damage", data);

  const returnQty = Number(quantity);
  const rid = Number(receivedId);

  if (!rid) throw new ApiError(400, "receivedId is required");
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

    const result = await DamageProduct.create(
      {
        name: received.name,
        supplier: received.supplier,
        quantity: returnQty,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        productId: realProductId, // ✅ Products.Id (FK)
        status: finalStatus || "---",
        note: note || "---",
        date: date,
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

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: DamageProductSearchableFields.map((field) => ({
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
      createdAt: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await DamageProduct.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await DamageProduct.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    DamageProduct.count({ where: whereConditions }),
    DamageProduct.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await DamageProduct.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await DamageProduct.findOne({
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
    await DamageProduct.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

const updateOneFromDB = async (id, data) => {
  const { quantity, receivedId, note, status, userId } = data;

  console.log("Damage", data);

  const returnQty = Number(quantity);
  const rid = Number(receivedId);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

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

    const [updatedCount] = await DamageProduct.update(
      {
        name: received.name,
        supplier: received.supplier,
        quantity: returnQty,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        note: status === "Approved" ? "---" : note,
        status: status ? status : "Pending",
        productId: realProductId, // ✅ Products.Id (FK)
      },
      {
        where: { Id: id },
        transaction: t,
      },
    );

    if (status === "Approved") {
      await ReceivedProduct.update(
        {
          quantity: oldQty - returnQty,
          purchase_price: Math.max(
            0,
            Number(received.purchase_price || 0) - deductPurchase,
          ),
          sale_price: Math.max(
            0,
            Number(received.sale_price || 0) - deductSale,
          ),
        },
        { where: { Id: received.Id }, transaction: t },
      );
    }

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId }, // sender বাদ
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
      },
    });

    console.log("users", users.length);
    if (!users.length) return updatedCount;

    const message =
      finalStatus === "Approved"
        ? "Damage product request approved"
        : finalNote || "Damage product updated";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `http://localhost:5173/damage-product`,
        }),
      ),
    );
    return updatedCount;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await DamageProduct.findAll();

  return result;
};

const DamageProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = DamageProductService;
