const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  ReceivedProductSearchableFields,
} = require("./receivedProduct.constants");

const ReceivedProduct = db.receivedProduct;
const Product = db.product;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;
const WarrantyProduct = db.warrantyProduct;
const CashInOut = db.cashInOut;
const SupplierHistory = db.supplierHistory;

const insertIntoDB = async (data, file) => {
  const {
    quantity,
    productId,
    date,
    status,
    note,
    purchase_price,
    sale_price,
    warrantyValue,
    warrantyUnit,
    userId,
    bookId,
    supplierId,
    warehouseId,
  } = data;

  const productData = await Product.findOne({ where: { Id: productId } });
  if (!productData) throw new ApiError(404, "Product not found");

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  const isApproved = String(status || "").trim() === "Approved";

  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : note
        ? "Pending"
        : "Active";

  return db.sequelize.transaction(async (t) => {
    const payload = {
      name: productData.name,
      quantity,
      source: "Received Product",
      purchase_price: Number(purchase_price),
      sale_price: Number(sale_price),
      supplierId,
      warehouseId,
      productId,
      status: finalStatus || "---",
      note: note || null,
      date: date,
    };

    const result = await ReceivedProduct.create(payload, { transaction: t });

    const supplierData = {
      supplierId,
      bookId,
      amount: Number(purchase_price || 0) * Number(quantity || 0),
      date,
      file,
    };

    await SupplierHistory.create(supplierData, { transaction: t });

    // ✅ InventoryMaster: থাকলে update, না থাকলে insert
    if (result) {
      const inv = await InventoryMaster.findOne({
        where: { productId },
        transaction: t,
        lock: t.LOCK.UPDATE, // optional but helpful
      });

      if (inv) {
        await inv.update(
          {
            quantity: Number(inv.quantity || 0) + Number(quantity || 0),
          },
          { transaction: t },
        );
      } else {
        await InventoryMaster.create(
          {
            productId,
            name: productData.name,
            quantity: Number(quantity || 0),
            purchase_price: Number(purchase_price),
            sale_price: Number(sale_price),
          },
          { transaction: t },
        );
      }
    }

    if (Number(warrantyValue) > 0 && warrantyUnit) {
      const warrantyRows = {
        name: productData.name,
        price: Number(purchase_price),
        quantity,
        date: date,
        warrantyValue: Number(warrantyValue) || 0,
        warrantyUnit: warrantyUnit || null,
      };

      await WarrantyProduct.create(warrantyRows, { transaction: t });
    }
    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
      transaction: t,
    });

    if (users.length) {
      const message =
        status === "Approved"
          ? "Received product request approved"
          : note || "Please approve my request";

      await Promise.all(
        users.map((u) =>
          Notification.create(
            { userId: u.Id, message, url: "/purchase-requisition" },
            { transaction: t },
          ),
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

  // ✅ Search (ILIKE)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ReceivedProductSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ Exact filters
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range
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

  // ✅ paginated data
  const data = await ReceivedProduct.findAll({
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

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    ReceivedProduct.count({ where: whereConditions }),
    ReceivedProduct.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: {
      count, // total filtered records
      totalQuantity: totalQuantity || 0, // total filtered quantity
      page,
      limit,
    },
    data,
  };
};

const getDataById = async (id) => {
  const result = await ReceivedProduct.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

// const deleteIdFromDB = async (id) => {
//   const result = await ReceivedProduct.destroy({
//     where: {
//       Id: id,
//     },
//   });

//   return result;
// };

const deleteIdFromDB = async (id) => {
  return db.sequelize.transaction(async (t) => {
    // ✅ 1) row খুঁজে বের করো
    const existing = await ReceivedProduct.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "productId",
        "quantity",
        "purchase_price",
        "sale_price",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) throw new ApiError(404, "Received product not found");

    const productId = Number(existing.productId);
    const qty = Number(existing.quantity || 0);
    const purchaseTotal = Number(existing.purchase_price || 0);
    const saleTotal = Number(existing.sale_price || 0);

    // ✅ 2) InventoryMaster subtract
    const inv = await InventoryMaster.findOne({
      where: { productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (inv) {
      const nextQty = Number(inv.quantity || 0) - qty;

      // চাইলে negative prevent করতে পারেন
      // if (nextQty < 0) throw new ApiError(400, "Inventory cannot be negative");

      await inv.update(
        {
          quantity: nextQty,
        },
        { transaction: t },
      );
    }

    // ✅ 3) ReceivedProduct delete (paranoid true হলে soft delete হবে)
    await ReceivedProduct.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

// const updateOneFromDB = async (id, payload) => {
//   const {
//     quantity,
//     productId,
//     note,
//     status,
//     date,
//     userId,
//     supplierId,
//     warehouseId,
//     actorRole,
//   } = payload;

//   const productData = await Product.findOne({
//     where: { Id: productId },
//   });

//   if (!productData) throw new ApiError(404, "Product not found");

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10);

//   return db.sequelize.transaction(async (t) => {
//     // ✅ existing (lock)
//     const existing = await ReceivedProduct.findOne({
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

//     const appliedQty =
//       isPrivileged && isStockStatus(newStatus)
//         ? Number(existing.requestedQuantity ?? requestedQty) // approve হলে requestedQuantity priority
//         : Number(existing.quantity || 0); // inventor/pending হলে quantity unchanged

//     const message =
//       newStatus === "Approved"
//         ? "Purchase  product request approved"
//         : newNote || "Please approved my request";

//     // ✅ data (ReceivedProduct)
//     const data = {
//       name: productData.name,
//       supplierId,
//       warehouseId,
//       productId,
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
//         where: { productId },
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

//     const [updatedCount] = await ReceivedProduct.update(data, {
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
//             url: `/kafelamart.digitalever.com.bd/purchase-product`,
//           },
//           { transaction: t },
//         ),
//       ),
//     );

//     return updatedCount;
//   });
// };

// const updateOneFromDB = async (id, payload) => {
//   const {
//     quantity,
//     productId,
//     note,
//     status,
//     date,
//     userId,
//     supplierId,
//     warehouseId,
//     actorRole,
//   } = payload;

//   const productData = await Product.findOne({
//     where: {
//       Id: productId,
//     },
//   });

//   if (!productData) {
//     throw new ApiError(404, "Product not found");
//   }

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10);

//   return db.sequelize.transaction(async (t) => {
//     // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
//     const existing = await ReceivedProduct.findOne({
//       where: { Id: id },
//       attributes: ["Id", "note", "status", "quantity"],
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!existing) return 0;

//     const qty = Number(existing.quantity || 0);
//     const oldNote = String(existing.note || "").trim();
//     const newNote = String(note || "").trim();

//     // ✅ newNote খালি না হলে + oldNote থেকে আলাদা হলে => pending trigger
//     const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;

//     // ✅ today না হলে pending trigger (date না পাঠালে trigger হবে না)
//     const dateTriggersPending =
//       Boolean(inputDateStr) && inputDateStr !== todayStr;

//     const inputStatus = String(status || "").trim();

//     let finalStatus = existing.status || "Pending";

//     const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

//     if (isPrivileged) {
//       // ✅ superAdmin/admin: যা পাঠাবে সেটাই
//       finalStatus = inputStatus || finalStatus;
//     } else {
//       // ✅ others: today date না হলে বা new note হলে Pending override
//       if (dateTriggersPending || noteTriggersPending) {
//         finalStatus = "Pending";
//       } else {
//         // ✅ otherwise: status পাঠালে সেটাই, না পাঠালে আগেরটা
//         finalStatus = inputStatus || finalStatus;
//       }
//     }

//     const message =
//       finalStatus === "Approved"
//         ? "Purchase  product request approved"
//         : note || "Please approved my request";

//     const data = {
//       name: productData.name,
//       quantity,
//       purchase_price: productData.purchase_price * quantity,
//       sale_price: productData.sale_price * quantity,
//       supplierId,
//       warehouseId,
//       productId,
//       note: newNote || null,
//       status: finalStatus,
//       date: inputDateStr || undefined,
//     };

//     let receivedFinalQty = 0;
//     if (Number(qty) > Number(quantity)) {
//       receivedFinalQty = Number(qty) - Number(quantity);
//     } else {
//       receivedFinalQty = Number(quantity) - Number(qty);
//     }

//     // ✅ 2) InventoryMaster subtract
//     const inv = await InventoryMaster.findOne({
//       where: { productId },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (inv) {
//       let stockQuantity = 0;
//       if (Number(qty) > Number(quantity)) {
//         stockQuantity = Number(inv.quantity) - Number(receivedFinalQty);
//       } else {
//         stockQuantity = Number(inv.quantity) + Number(receivedFinalQty);
//       }

//       // চাইলে negative prevent করতে পারেন
//       if (stockQuantity < 0)
//         throw new ApiError(400, "Inventory cannot be negative");
//       const oldQty = Number(inv.quantity);

//       const perUnitPurchase =
//         oldQty > 0 ? Number(inv.purchase_price || 0) / oldQty : 0;
//       const perUnitSale = oldQty > 0 ? Number(inv.sale_price || 0) / oldQty : 0;

//       await inv.update(
//         {
//           quantity: stockQuantity,
//           purchase_price: perUnitPurchase * stockQuantity,
//           sale_price: perUnitSale * stockQuantity,
//         },
//         { transaction: t },
//       );
//     }

//     const [updatedCount] = await ReceivedProduct.update(data, {
//       where: {
//         Id: id,
//       },
//       transaction: t,
//     });

//     const users = await User.findAll({
//       attributes: ["Id", "role"],
//       where: {
//         Id: { [Op.ne]: userId }, // sender বাদ
//         role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
//       },
//     });

//     console.log("users", users.length);
//     if (!users.length) return updatedCount;

//     await Promise.all(
//       users.map((u) =>
//         Notification.create({
//           userId: u.Id,
//           message,
//           url: `/kafelamart.digitalever.com.bd/purchase-product`,
//         }),
//       ),
//     );

//     return updatedCount;
//   });
// };

const updateOneFromDB = async (id, payload) => {
  const {
    quantity,
    productId,
    note,
    status,
    date,
    userId,
    supplierId,
    bookId,
    warehouseId,
    purchase_price,
    sale_price,
    actorRole,
    file,
  } = payload;

  const productData = await Product.findOne({
    where: { Id: productId },
  });

  if (!productData) throw new ApiError(404, "Product not found");

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  return db.sequelize.transaction(async (t) => {
    // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
    const existing = await ReceivedProduct.findOne({
      where: { Id: id },
      attributes: ["Id", "note", "status", "quantity"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    // const payableData = {
    //   supplierId,
    //   amount: paidAmount,
    //   date,
    //   file,
    // };

    // await Payable.create(payableData, { transaction: t });

    const qty = Number(existing.quantity || 0);
    const oldNote = String(existing.note || "").trim();
    const newNote = String(note || "").trim();

    const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
    const dateTriggersPending =
      Boolean(inputDateStr) && inputDateStr !== todayStr;

    const inputStatus = String(status || "").trim();

    let finalStatus = existing.status || "Pending";
    const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

    if (isPrivileged) {
      finalStatus = inputStatus || finalStatus;
    } else {
      if (dateTriggersPending || noteTriggersPending) {
        finalStatus = "Pending";
      } else {
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
      purchase_price: purchase_price * quantity,
      sale_price: sale_price * quantity,
      supplierId,
      warehouseId,
      productId,
      note: newNote || null,
      status: finalStatus,
      date: inputDateStr || undefined,
      file,
    };

    let receivedFinalQty = 0;
    if (Number(qty) > Number(quantity)) {
      receivedFinalQty = Number(qty) - Number(quantity);
    } else {
      receivedFinalQty = Number(quantity) - Number(qty);
    }

    // ✅ 2) InventoryMaster: যদি থাকে update, না থাকলে insert
    let inv = await InventoryMaster.findOne({
      where: { productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!inv) {
      // ✅ insert
      // qty->quantity এর change অনুযায়ী stockQuantity বানাই (existing inv না থাকায় old inv qty = 0 ধরি)
      const stockQuantity = Number(quantity || 0);

      await InventoryMaster.create(
        {
          name: productData.name,
          price: sale_price,
          productId,
          quantity: stockQuantity,
          purchase_price: Number(purchase_price || 0),
          sale_price: Number(sale_price || 0),
          // যদি তোমার টেবিলে warehouseId/supplierId লাগে, চাইলে add করো:
          // warehouseId,
          // supplierId,
        },
        { transaction: t },
      );
    } else {
      // ✅ update (তোমার আগের লজিক same)
      let stockQuantity = 0;

      if (Number(qty) > Number(quantity)) {
        stockQuantity = Number(inv.quantity) - Number(receivedFinalQty);
      } else {
        stockQuantity = Number(inv.quantity) + Number(receivedFinalQty);
      }

      if (stockQuantity < 0)
        throw new ApiError(400, "Inventory cannot be negative");

      await inv.update(
        {
          quantity: stockQuantity,
          purchase_price,
          sale_price,
        },
        { transaction: t },
      );
    }

    const [updatedCount] = await ReceivedProduct.update(data, {
      where: { Id: id },
      transaction: t,
    });

    const supplierData = {
      supplierId,
      bookId,
      amount: Number(purchase_price || 0) * Number(quantity || 0),
      date,
      file,
    };

    await SupplierHistory.update(
      supplierData,
      { where: { supplierId } },
      { transaction: t },
    );

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
      transaction: t,
    });

    if (!users.length) return updatedCount;

    await Promise.all(
      users.map((u) =>
        Notification.create(
          {
            userId: u.Id,
            message,
            url: `/kafelamart.digitalever.com.bd/purchase-product`,
          },
          { transaction: t },
        ),
      ),
    );

    return updatedCount;
  });
};
const getAllFromDBWithoutQuery = async () => {
  const result = await ReceivedProduct.findAll();

  return result;
};

const ReceivedProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ReceivedProductService;
