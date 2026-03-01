const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ReturnProductSearchableFields } = require("./returnProduct.constants");
const ReturnProduct = db.returnProduct;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;
const Product = db.product;

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

  console.log("Return", data);

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
    const inventory = await InventoryMaster.findOne({
      where: { productId: rid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!inventory) throw new ApiError(404, "inventory product not found");

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

    const realProductId = Number(inventory.productId);
    if (!realProductId) {
      throw new ApiError(
        400,
        "InventoryMaster.productId missing (Products.Id)",
      );
    }

    const result = await ReturnProduct.create(
      {
        name: inventory.name,
        supplierId,
        warehouseId,
        quantity: returnQty,
        purchase_price: inventory.purchase_price * returnQty,
        sale_price: inventory.sale_price * returnQty,
        productId: realProductId, // ✅ Products.Id (FK)
        status: finalStatus || "---",
        note: note || null,
        date: date,
      },
      { transaction: t },
    );

    const finalQuantity = oldQty + returnQty;
    await InventoryMaster.update(
      {
        quantity: finalQuantity,
        purchase_price: Number(inventory.purchase_price * finalQuantity),
        sale_price: Number(inventory.sale_price * finalQuantity),
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
      [Op.or]: ReturnProductSearchableFields.map((field) => ({
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

  const result = await ReturnProduct.findAll({
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

  // const total = await ReturnProduct.count({ where: whereConditions });
  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    ReturnProduct.count({ where: whereConditions }),
    ReturnProduct.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await ReturnProduct.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await ReturnProduct.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");

    const qty = Number(ret.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

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
        quantity: Number(received.quantity || 0) - qty,
        purchase_price:
          Number(received.purchase_price || 0) +
          Number(ret.purchase_price || 0),
        sale_price:
          Number(received.sale_price || 0) + Number(ret.sale_price || 0),
      },
      { where: { Id: received.Id }, transaction: t },
    );

    // 4) Return row delete
    await ReturnProduct.destroy({
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
//     const existing = await ReturnProduct.findOne({
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
//         ? "Purchase  product request approved"
//         : newNote || "Please approved my request";

//     // ✅ data (ReturnProduct)
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
//           stockQuantity = Number(inv.quantity) - Number(receivedFinalQty);
//         } else {
//           stockQuantity = Number(inv.quantity) + Number(receivedFinalQty);
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

//     const [updatedCount] = await ReturnProduct.update(data, {
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
//             url: `/kafelamart.digitalever.com.bd/purchase-return`,
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
    const existing = await ReturnProduct.findOne({
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
        stockQuantity = Number(inv.quantity) - Number(receivedFinalQty);
      } else {
        stockQuantity = Number(inv.quantity) + Number(receivedFinalQty);
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

    const [updatedCount] = await ReturnProduct.update(data, {
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
  const result = await ReturnProduct.findAll();

  return result;
};

const ReturnProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ReturnProductService;
