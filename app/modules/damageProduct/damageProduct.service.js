const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { DamageProductSearchableFields } = require("./damageProduct.constants");
const DamageProduct = db.damageProduct;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;

// const insertIntoDB = async (data) => {
//   const { quantity, productId } = data;

//   const qty = Number(quantity);

//   if (!qty || qty <= 0) {
//     throw new ApiError(400, "Quantity must be greater than 0");
//   }

//   return await db.sequelize.transaction(async (t) => {
//     // ✅ InventoryMaster (stock)
//     // ⚠️ যদি তোমার InventoryMaster এ productId নামে কলাম থাকে, তাহলে where: { productId } করবে
//     const received = await InventoryMaster.findOne({
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

//     // ✅ Update InventoryMaster (subtract qty & totals)
//     const newQty = availableQty - qty;

//     const newPurchaseTotal = Math.max(
//       0,
//       Number(received.purchase_price) - returnPurchase,
//     );

//     const newSaleTotal = Math.max(0, Number(received.sale_price) - returnSale);

//     await InventoryMaster.update(
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
  const {
    quantity,
    receivedId,
    date,
    note,
    status,
    userId,
    supplierId,
    warehouseId,
  } = data;

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
      : note
        ? "Pending"
        : "Active";

  return await db.sequelize.transaction(async (t) => {
    const received = await InventoryMaster.findOne({
      where: { productId: rid },
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
        "InventoryMaster.productId missing (Products.Id)",
      );
    }

    const result = await DamageProduct.create(
      {
        name: received.name,
        supplierId,
        warehouseId,
        quantity: returnQty,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        productId: realProductId, // ✅ Products.Id (FK)
        status: finalStatus || "---",
        note: note || null,
        date: date,
      },
      { transaction: t },
    );

    await InventoryMaster.update(
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

  const result = await DamageProduct.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: [
      {
        model: Supplier,
        as: "supplier",
        attributes: ["Id", "name"],
      },
      {
        model: Warehouse,
        as: "warehouse",
        attributes: ["Id", "name"],
      },
    ],
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
    // if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    // 2) InventoryMaster খুঁজে বের করো (Products.Id দিয়ে)
    const received = await InventoryMaster.findOne({
      where: { productId: ret.productId }, // ✅ Products.Id
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) throw new ApiError(404, "Received product not found");

    // 3) stock ফিরিয়ে দাও
    await InventoryMaster.update(
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

// const updateOneFromDB = async (id, data) => {
//   const {
//     quantity,
//     receivedId,
//     note,
//     date,
//     status,
//     userId,
//     supplierId,
//     warehouseId,
//     actorRole,
//   } = data;

//   console.log("Damage", data);

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10);

//   // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
//   const existing = await DamageProduct.findOne({
//     where: { Id: id },
//     attributes: ["Id", "note", "status"],
//   });

//   if (!existing) return 0;

//   const oldNote = String(existing.note || "").trim();
//   const newNote = String(note || "").trim();

//   // ✅ newNote খালি না হলে + oldNote থেকে আলাদা হলে => pending trigger
//   const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;

//   // ✅ today না হলে pending trigger (date না পাঠালে trigger হবে না)
//   const dateTriggersPending =
//     Boolean(inputDateStr) && inputDateStr !== todayStr;

//   const inputStatus = String(status || "").trim();

//   let finalStatus = existing.status || "Pending";

//   const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

//   if (isPrivileged) {
//     // ✅ superAdmin/admin: যা পাঠাবে সেটাই
//     finalStatus = inputStatus || finalStatus;
//   } else {
//     // ✅ others: today date না হলে বা new note হলে Pending override
//     if (dateTriggersPending || noteTriggersPending) {
//       finalStatus = "Pending";
//     } else {
//       // ✅ otherwise: status পাঠালে সেটাই, না পাঠালে আগেরটা
//       finalStatus = inputStatus || finalStatus;
//     }
//   }

//   const returnQty = Number(quantity);
//   const rid = Number(receivedId);

//   if (!rid) throw new ApiError(400, "receivedId is required");
//   if (!returnQty || returnQty <= 0) {
//     throw new ApiError(400, "Quantity must be greater than 0");
//   }

//   return await db.sequelize.transaction(async (t) => {
//     const received = await InventoryMaster.findOne({
//       where: { productId: rid },
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
//         "InventoryMaster.productId missing (Products.Id)",
//       );
//     }

//     const [updatedCount] = await DamageProduct.update(
//       {
//         name: received.name,
//         supplierId,
//         warehouseId,
//         quantity: returnQty,
//         purchase_price: deductPurchase,
//         sale_price: deductSale,
//         note: newNote || null,
//         status: finalStatus,
//         date: inputDateStr || undefined,
//       },
//       {
//         where: { Id: id },
//         transaction: t,
//       },
//     );

//     if (status === "Approved") {
//       await InventoryMaster.update(
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
//         ? "Damage product request approved"
//         : note || "Damage product updated";

//     await Promise.all(
//       users.map((u) =>
//         Notification.create({
//           userId: u.Id,
//           message,
//           url: `/kafelamart.digitalever.com.bd/damage-product`,
//         }),
//       ),
//     );
//     return updatedCount;
//   });
// };

const updateOneFromDB = async (id, payload) => {
  const {
    quantity,
    receivedId,
    note,
    status,
    date,
    userId,
    supplierId,
    warehouseId,
    actorRole,
  } = payload;

  const productData = await Product.findOne({
    where: {
      Id: receivedId,
    },
  });

  if (!productData) {
    throw new ApiError(404, "Product not found");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  return db.sequelize.transaction(async (t) => {
    // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
    const existing = await DamageProduct.findOne({
      where: { Id: id },
      attributes: ["Id", "note", "status", "quantity"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    const qty = Number(existing.quantity || 0);
    const oldNote = String(existing.note || "").trim();
    const newNote = String(note || "").trim();

    // ✅ newNote খালি না হলে + oldNote থেকে আলাদা হলে => pending trigger
    const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;

    // ✅ today না হলে pending trigger (date না পাঠালে trigger হবে না)
    const dateTriggersPending =
      Boolean(inputDateStr) && inputDateStr !== todayStr;

    const inputStatus = String(status || "").trim();

    let finalStatus = existing.status || "Pending";

    const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

    if (isPrivileged) {
      // ✅ superAdmin/admin: যা পাঠাবে সেটাই
      finalStatus = inputStatus || finalStatus;
    } else {
      // ✅ others: today date না হলে বা new note হলে Pending override
      if (dateTriggersPending || noteTriggersPending) {
        finalStatus = "Pending";
      } else {
        // ✅ otherwise: status পাঠালে সেটাই, না পাঠালে আগেরটা
        finalStatus = inputStatus || finalStatus;
      }
    }

    const message =
      finalStatus === "Approved"
        ? "Purchase  product request approved"
        : note || "Please approved my request";

    const data = {
      name: productData.name,
      quantity,
      purchase_price: productData.purchase_price * quantity,
      sale_price: productData.sale_price * quantity,
      supplierId,
      warehouseId,
      productId: receivedId,
      note: newNote || null,
      status: finalStatus,
      date: inputDateStr || undefined,
    };

    let receivedFinalQty = 0;
    if (Number(qty) > Number(quantity)) {
      receivedFinalQty = Number(qty) - Number(quantity);
    } else {
      receivedFinalQty = Number(quantity) - Number(qty);
    }

    // ✅ 2) InventoryMaster subtract
    const inv = await InventoryMaster.findOne({
      where: { productId: receivedId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (inv) {
      let stockQuantity = 0;
      if (Number(qty) > Number(quantity)) {
        stockQuantity = Number(inv.quantity) + Number(receivedFinalQty);
      } else {
        stockQuantity = Number(inv.quantity) - Number(receivedFinalQty);
      }

      // চাইলে negative prevent করতে পারেন
      if (stockQuantity < 0)
        throw new ApiError(400, "Inventory cannot be negative");
      const oldQty = Number(inv.quantity);

      const perUnitPurchase =
        oldQty > 0 ? Number(inv.purchase_price || 0) / oldQty : 0;
      const perUnitSale = oldQty > 0 ? Number(inv.sale_price || 0) / oldQty : 0;

      await inv.update(
        {
          quantity: stockQuantity,
          purchase_price: perUnitPurchase * stockQuantity,
          sale_price: perUnitSale * stockQuantity,
        },
        { transaction: t },
      );
    }

    const [updatedCount] = await DamageProduct.update(data, {
      where: {
        Id: id,
      },
      transaction: t,
    });

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId }, // sender বাদ
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
      },
    });

    console.log("users", users.length);
    if (!users.length) return updatedCount;

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/kafelamart.digitalever.com.bd/purchase-product`,
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
