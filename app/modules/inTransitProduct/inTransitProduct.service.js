const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  InTransitProductSearchableFields,
} = require("./inTransitProduct.constants");
const mergeVariants = require("../../../shared/mergeVariants");
const parseVariants = require("../../../shared/parseVariants");
const subtractVariants = require("../../../shared/subtractVariants");
const InTransitProduct = db.inTransitProduct;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;

const findInventoryByStoredReference = async (receivedId, transaction) => {
  const inventoryByInventoryId = await InventoryMaster.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (inventoryByInventoryId) return inventoryByInventoryId;

  return InventoryMaster.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
};

const findInventoryByRequestReference = async (receivedId, transaction) => {
  const inventoryByProductId = await InventoryMaster.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (inventoryByProductId) return inventoryByProductId;

  return findInventoryByStoredReference(receivedId, transaction);
};

const insertIntoDB = async (data) => {
  const {
    quantity,
    receivedId,
    variants,
    date,
    note,
    status,
    userId,
    supplierId,
    warehouseId,
  } = data;

  console.log("InTransit", data);

  const returnQty = Number(quantity);
  const rid = Number(receivedId);
  const incomingVariants = parseVariants(variants);

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
    const inventory = await findInventoryByRequestReference(rid, t);

    if (!inventory) throw new ApiError(404, "Received product not found");

    const oldQty = Number(inventory.quantity || 0);
    if (oldQty < returnQty) {
      throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
    }

    // const perUnitPurchase =
    //   oldQty > 0 ? Number(inventory.purchase_price || 0) / oldQty : 0;
    // const perUnitSale =
    //   oldQty > 0 ? Number(inventory.sale_price || 0) / oldQty : 0;

    // const deductPurchase = perUnitPurchase * returnQty;
    // const deductSale = perUnitSale * returnQty;

    const inventoryId = Number(inventory.Id);
    if (!inventoryId) {
      throw new ApiError(400, "InventoryMaster.Id missing");
    }

    const result = await InTransitProduct.create(
      {
        name: inventory.name,
        supplierId,
        warehouseId,
        quantity: returnQty,
        variants: incomingVariants,
        source: "In Transit Product",
        purchase_price: Number(inventory.purchase_price * returnQty),
        sale_price: Number(inventory.sale_price * returnQty),
        productId: inventoryId,
        status: finalStatus || "---",
        note: note || null,
        date: date,
      },
      { transaction: t },
    );

    const finalQuantity = oldQty - returnQty;
    const finalVariants = incomingVariants.length
      ? subtractVariants(inventory.variants, incomingVariants)
      : inventory.variants;

    await InventoryMaster.update(
      {
        quantity: finalQuantity,
        variants: finalVariants,
        // purchase_price: Number(inventory.purchase_price * finalQuantity),
        // sale_price: Number(inventory.sale_price * finalQuantity),
      },
      { where: { Id: inventory.Id }, transaction: t },
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
      [Op.or]: InTransitProductSearchableFields.map((field) => ({
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

  const result = await InTransitProduct.findAll({
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

  const total = await InTransitProduct.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    InTransitProduct.count({ where: whereConditions }),
    InTransitProduct.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await InTransitProduct.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await InTransitProduct.findOne({
      where: { Id: id },
      attributes: ["Id", "productId", "quantity", "variants"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");

    const qty = Number(ret.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    // 2) InventoryMaster খুঁজে বের করো (Products.Id দিয়ে)
    const received = await findInventoryByStoredReference(
      Number(ret.productId),
      t,
    );

    if (!received) throw new ApiError(404, "Received product not found");

    const finalQuantity = Number(received.quantity || 0) + qty;
    const finalVariants = mergeVariants(received.variants, ret.variants);
    // 3) stock ফিরিয়ে দাও
    await InventoryMaster.update(
      {
        quantity: finalQuantity,
        variants: finalVariants,
        // purchase_price: Number(received.purchase_price * finalQuantity),
        // sale_price: Number(received.sale_price * finalQuantity),
      },
      { where: { Id: received.Id }, transaction: t },
    );

    // 4) Return row delete
    await InTransitProduct.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

// const updateOneFromDB = async (id, payload) => {
//   const {
//     quantity,
//     receivedId,
//     note,
//     status,
//     date,
//     userId,
//     supplierId,
//     warehouseId,
//     actorRole,
//   } = payload;

//   const productData = await Product.findOne({
//     where: { Id: receivedId },
//   });

//   if (!productData) throw new ApiError(404, "Product not found");

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10);

//   return db.sequelize.transaction(async (t) => {
//     // ✅ existing (lock)
//     const existing = await InTransitProduct.findOne({
//       where: { Id: id },
//       attributes: ["Id", "note", "status", "quantity", "requestedQuantity"],
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!existing) return 0;

//     const oldStatus = String(existing.status || "").trim();
//     const oldNote = String(existing.note || "").trim();
//     const newNote = String(note || "").trim();

//     const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
//     const dateTriggersPending =
//       Boolean(inputDateStr) && inputDateStr !== todayStr;

//     const inputStatus = String(status || "").trim();
//     const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

//     let finalStatus = existing.status || "Pending";

//     if (isPrivileged) {
//       finalStatus = inputStatus || finalStatus;
//     } else {
//       finalStatus = "Pending"; // ✅ অন্য actorRole হলে always Pending
//     }

//     const newStatus = String(finalStatus || "").trim();

//     // ✅ কোন quantity টা এখন apply হবে?
//     // - Inventor: শুধু requestedQuantity সেট করবে, main quantity বদলাবে না
//     // - Admin যখন Approved/Active করবে: requestedQuantity থাকলে সেটাই apply হবে
//     const isStockStatus = (s) => s === "Approved" || s === "Active";

//     const requestedQty = Number(quantity || 0);

//     console.log("requestedQty", requestedQty);

//     const appliedQty =
//       isPrivileged && isStockStatus(newStatus)
//         ? Number(existing.requestedQuantity ?? requestedQty) // approve হলে requestedQuantity priority
//         : Number(existing.quantity || 0); // inventor/pending হলে quantity unchanged

//     const message =
//       newStatus === "Approved"
//         ? "InTransitProduct  product request approved"
//         : newNote || "Please approved my request";

//     // ✅ data (InTransitProduct)
//     const data = {
//       name: productData.name,
//       supplierId,
//       warehouseId,
//       productId: receivedId,
//       note: newNote || null,
//       status: finalStatus,
//       date: inputDateStr || undefined,
//     };

//     if (isPrivileged && isStockStatus(newStatus)) {
//       // ✅ approve/active হলে main quantity আপডেট হবে
//       data.quantity = appliedQty;
//       data.purchase_price = productData.purchase_price * appliedQty;
//       data.sale_price = productData.sale_price * appliedQty;

//       // ✅ approve হয়ে গেলে request clear করে দাও
//       data.requestedQuantity = null;
//     } else {
//       // ✅ inventor/other role হলে main quantity বদলাবে না
//       // শুধু request জমা হবে
//       data.quantity = Number(existing.quantity || 0);
//       data.purchase_price =
//         productData.purchase_price * Number(existing.quantity || 0);
//       data.sale_price = productData.sale_price * Number(existing.quantity || 0);

//       // inventor edit করলে requestedQuantity সেট হবে (admin approve করার জন্য)
//       data.requestedQuantity = requestedQty;
//     }

//     // ✅ InventoryMaster update হবে শুধু admin/superAdmin + Approved/Active হলে
//     const shouldUpdateInventory = isPrivileged && isStockStatus(newStatus);

//     if (shouldUpdateInventory) {
//       // ----- ✅ তোমার calculation ব্লক (unchanged) -----
//       const qty = Number(existing.quantity || 0); // old applied qty (e.g. 100)
//       const quantityToApply = Number(appliedQty || 0); // new applied qty (e.g. 80)

//       let receivedFinalQty = 0;
//       if (Number(qty) > Number(quantityToApply)) {
//         receivedFinalQty = Number(qty) - Number(quantityToApply);
//       } else {
//         receivedFinalQty = Number(quantityToApply) - Number(qty);
//       }

//       const inv = await InventoryMaster.findOne({
//         where: { productId: receivedId },
//         transaction: t,
//         lock: t.LOCK.UPDATE,
//       });

//       if (inv) {
//         let stockQuantity = 0;
//         if (Number(qty) > Number(quantityToApply)) {
//           stockQuantity = Number(inv.quantity) + Number(receivedFinalQty);
//         } else {
//           stockQuantity = Number(inv.quantity) - Number(receivedFinalQty);
//         }

//         if (stockQuantity < 0)
//           throw new ApiError(400, "Inventory cannot be negative");

//         const oldQty = Number(inv.quantity);

//         const perUnitPurchase =
//           oldQty > 0 ? Number(inv.purchase_price || 0) / oldQty : 0;
//         const perUnitSale =
//           oldQty > 0 ? Number(inv.sale_price || 0) / oldQty : 0;

//         await inv.update(
//           {
//             quantity: stockQuantity,
//             purchase_price: perUnitPurchase * stockQuantity,
//             sale_price: perUnitSale * stockQuantity,
//           },
//           { transaction: t },
//         );
//       }
//       // ----- ✅ calculation ব্লক end -----
//     }

//     const [updatedCount] = await InTransitProduct.update(data, {
//       where: { Id: id },
//       transaction: t,
//     });

//     const users = await User.findAll({
//       attributes: ["Id", "role"],
//       where: {
//         Id: { [Op.ne]: userId },
//         role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
//       },
//       transaction: t,
//     });

//     if (!users.length) return updatedCount;

//     await Promise.all(
//       users.map((u) =>
//         Notification.create(
//           {
//             userId: u.Id,
//             message,
//             url: `/holygift.digitalever.com.bd/purchase-return`,
//           },
//           { transaction: t },
//         ),
//       ),
//     );

//     return updatedCount;
//   });
// };

const updateOneFromDB = async (id, payload) => {
  const {
    quantity,
    receivedId,
    variants,
    note,
    status,
    date,
    userId,
    supplierId,
    warehouseId,
    actorRole,
  } = payload;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);
  const incomingVariants = parseVariants(variants);
  const nextQty = Number(quantity || 0);

  return db.sequelize.transaction(async (t) => {
    // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
    const existing = await InTransitProduct.findOne({
      where: { Id: id },
      attributes: ["Id", "note", "status", "quantity", "variants", "productId"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    const qty = Number(existing.quantity || 0);
    const oldProductId = Number(existing.productId);
    const existingVariants = parseVariants(existing.variants);
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

    const oldInv = await InventoryMaster.findOne({
      where: { Id: oldProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldInv) throw new ApiError(404, "Old inventory product not found");

    await oldInv.update(
      {
        quantity: Number(oldInv.quantity || 0) + qty,
        variants: mergeVariants(oldInv.variants, existingVariants),
      },
      { transaction: t },
    );

    let targetInv = oldInv;
    if (Number(receivedId) !== oldProductId) {
      targetInv = await findInventoryByRequestReference(Number(receivedId), t);
    }

    if (!targetInv) throw new ApiError(404, "Product not found in inventory");

    const reducedQty = Number(targetInv.quantity || 0) - nextQty;
    if (reducedQty < 0) {
      throw new ApiError(400, "Inventory cannot be negative");
    }

    const updatedVariants = incomingVariants.length
      ? subtractVariants(targetInv.variants, incomingVariants)
      : targetInv.variants;

    const data = {
      name: targetInv.name,
      quantity: nextQty,
      variants: incomingVariants,
      purchase_price: Number(targetInv.purchase_price || 0) * nextQty,
      sale_price: Number(targetInv.sale_price || 0) * nextQty,
      supplierId,
      warehouseId,
      productId: targetInv.Id,
      note: newNote || null,
      status: finalStatus,
      date: inputDateStr || undefined,
    };

    await targetInv.update(
      {
        quantity: reducedQty,
        variants: updatedVariants,
      },
      { transaction: t },
    );

    const [updatedCount] = await InTransitProduct.update(data, {
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
          url: `/holygift.digitalever.com.bd/purchase-product`,
        }),
      ),
    );

    return updatedCount;
  });
};
const getAllFromDBWithoutQuery = async () => {
  const result = await InTransitProduct.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const InTransitProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = InTransitProductService;
