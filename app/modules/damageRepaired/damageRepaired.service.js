const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  DamageRepairedSearchableFields,
} = require("./damageRepaired.constants");
const DamageRepaired = db.damageRepaired;
const DamageRepair = db.damageRepair;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;
const DamageStock = db.damageStock;

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
    const damageRepair = await DamageRepair.findOne({
      where: { Id: rid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    console.log("DamageRepair", rid);

    if (!damageRepair)
      throw new ApiError(404, "DamageRepair product not found");

    const oldQty = Number(damageRepair.quantity || 0);
    if (oldQty < returnQty) {
      throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
    }

    const perUnitPurchase =
      oldQty > 0 ? Number(damageRepair.purchase_price || 0) / oldQty : 0;
    const perUnitSale =
      oldQty > 0 ? Number(damageRepair.sale_price || 0) / oldQty : 0;

    const deductPurchase = perUnitPurchase * returnQty;
    const deductSale = perUnitSale * returnQty;

    const realDamageStockId = Number(damageRepair.productId);
    if (!realDamageStockId) {
      throw new ApiError(400, "DamageRepair productId missing (Products.Id)");
    }

    const result = await DamageRepaired.create(
      {
        name: damageRepair.name,
        supplierId,
        warehouseId,
        source: "Damage Repaired",
        remarks: damageRepair.remarks,
        quantity: returnQty,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        productId: realDamageStockId, // ✅ Products.Id (FK)
        status: finalStatus || "---",
        note: note || null,
        date: date,
      },
      { transaction: t },
    );

    await DamageStock.update(
      {
        quantity: oldQty - returnQty,
        purchase_price: Math.max(
          0,
          Number(damageRepair.purchase_price || 0) - deductPurchase,
        ),
        sale_price: Math.max(
          0,
          Number(damageRepair.sale_price || 0) - deductSale,
        ),
      },
      { where: { Id: damageRepair.Id }, transaction: t },
    );

    const damageStock = await DamageStock.findOne({
      where: { productId: realDamageStockId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!damageStock) throw new ApiError(404, "Damage product not found");

    const inventory = await InventoryMaster.findOne({
      where: { productId: damageStock.productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!inventory) throw new ApiError(404, "Damage product not found");

    const receivedOldQty = Number(inventory.quantity || 0);

    const realinventoryId = Number(inventory.productId);
    if (!realinventoryId) {
      throw new ApiError(400, "DamageRepair productId missing (Products.Id)");
    }

    await InventoryMaster.update(
      {
        quantity: receivedOldQty + returnQty,
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
      [Op.or]: DamageRepairedSearchableFields.map((field) => ({
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

  const result = await DamageRepaired.findAll({
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

  // const total = await DamageRepaired.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    DamageRepaired.count({ where: whereConditions }),
    DamageRepaired.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await DamageRepaired.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await DamageRepaired.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");

    const qty = Number(ret.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    // 2) InventoryMaster খুঁজে বের করো (Products.Id দিয়ে)
    const received = await DamageRepair.findOne({
      where: { productId: ret.productId }, // ✅ Products.Id
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) throw new ApiError(404, "Received product not found");

    // 3) stock ফিরিয়ে দাও
    await DamageRepair.update(
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
    await DamageRepaired.destroy({
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
//   const existing = await DamageRepair.findOne({
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
//     const received = await DamageRepair.findOne({
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
//       throw new ApiError(400, "DamageRepair.productId missing (Products.Id)");
//     }

//     const [updatedCount] = await DamageRepaired.update(
//       {
//         name: received.name,
//         supplierId,
//         warehouseId,
//         remarks: received.remarks,
//         quantity: returnQty,
//         purchase_price: deductPurchase,
//         sale_price: deductSale,
//         note: newNote || null,
//         status: finalStatus,
//         date: inputDateStr || undefined,
//         productId: realProductId, // ✅ Products.Id (FK)
//       },
//       {
//         where: { Id: id },
//         transaction: t,
//       },
//     );

//     if (status === "Approved") {
//       await DamageRepair.update(
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

const updateOneFromDB = async (id, data) => {
  const {
    quantity,
    receivedId, // এটা DamageRepair.Id (source)
    note,
    date,
    status,
    userId,
    supplierId,
    warehouseId,
    actorRole,
  } = data;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  const inputStatus = String(status || "").trim();
  const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

  const returnQty = Number(quantity);
  const rid = Number(receivedId);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    // ✅ 0) যে রেকর্ডটা update হবে (DamageRepaired) সেটাই আগে lock করে আনো
    const existingRepaired = await DamageRepaired.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existingRepaired) return 0;

    const oldRepairedQty = Number(existingRepaired.quantity || 0);
    const oldRepairedStatus = String(existingRepaired.status || "").trim();

    const oldNote = String(existingRepaired.note || "").trim();
    const newNote = String(note || "").trim();

    const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
    const dateTriggersPending =
      Boolean(inputDateStr) && inputDateStr !== todayStr;

    // ✅ finalStatus (তোমার আগের লজিকের মতোই রাখা)
    let finalStatus = oldRepairedStatus || "Pending";
    if (isPrivileged) {
      finalStatus = inputStatus || finalStatus;
    } else {
      if (dateTriggersPending || noteTriggersPending) {
        finalStatus = "Pending";
      } else {
        finalStatus = inputStatus || finalStatus;
      }
    }

    const newStatus = String(finalStatus || "").trim();

    // ✅ 1) source DamageRepair (lock)
    const received = await DamageRepair.findOne({
      where: { Id: rid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) throw new ApiError(404, "DamageRepair product not found");

    const sourceQtyNow = Number(received.quantity || 0);

    // ✅ per-unit হিসাব (source values থেকে)
    const perUnitPurchase =
      sourceQtyNow > 0
        ? Number(received.purchase_price || 0) / sourceQtyNow
        : 0;
    const perUnitSale =
      sourceQtyNow > 0 ? Number(received.sale_price || 0) / sourceQtyNow : 0;

    const deductPurchaseNew = perUnitPurchase * returnQty;
    const deductSaleNew = perUnitSale * returnQty;

    const realProductId = Number(received.productId);
    if (!realProductId) {
      throw new ApiError(400, "DamageRepair.productId missing (Products.Id)");
    }

    // ✅ 2) DamageRepaired row update (main update)
    const [updatedCount] = await DamageRepaired.update(
      {
        name: received.name,
        supplierId,
        warehouseId,
        remarks: received.remarks,
        quantity: returnQty,
        purchase_price: deductPurchaseNew,
        sale_price: deductSaleNew,
        note: newNote || null,
        status: finalStatus,
        date: inputDateStr || undefined,
        productId: realProductId,
      },
      { where: { Id: id }, transaction: t },
    );

    // ✅ 3) Side effects ONLY when admin/superAdmin AND newStatus Approved
    // (তুমি চাইলে Active-ও add করতে পারো)
    const isStockStatus = (s) => s === "Approved"; // দরকার হলে: s === "Approved" || s === "Active"

    const oldWasStock = isStockStatus(oldRepairedStatus);
    const newIsStock = isStockStatus(newStatus);

    // 👉 কত qty ইনভেন্টরিতে add/remove হবে (double add prevent)
    let inventoryDelta = 0;

    if (!oldWasStock && newIsStock) {
      // Pending -> Approved : add full new qty
      inventoryDelta = returnQty;
    } else if (oldWasStock && newIsStock) {
      // Approved -> Approved : add only diff
      inventoryDelta = returnQty - oldRepairedQty;
    } else if (oldWasStock && !newIsStock) {
      // Approved -> Pending : reverse করতে চাইলে অন করো
      // inventoryDelta = -oldRepairedQty;
      inventoryDelta = 0;
    } else {
      inventoryDelta = 0;
    }

    // 👉 DamageRepair (source) কতটা কমবে/বাড়বে
    // Pending->Approved: source থেকে returnQty কমবে
    // Approved->Approved: diff অনুযায়ী adjust (qty কমলে source বাড়বে, qty বাড়লে source কমবে)
    // Approved->Pending reverse চাইলে source ফেরত যাবে
    let sourceDelta = 0; // source quantity change (negative মানে কমবে)

    if (!oldWasStock && newIsStock) {
      sourceDelta = -returnQty;
    } else if (oldWasStock && newIsStock) {
      // if new is larger => need take more from source (-diff)
      // if new is smaller => give back to source (+abs(diff))
      sourceDelta = -(returnQty - oldRepairedQty);
    } else if (oldWasStock && !newIsStock) {
      // reverse চাইলে:
      // sourceDelta = +oldRepairedQty;
      sourceDelta = 0;
    } else {
      sourceDelta = 0;
    }

    // ✅ 4) Apply inventory + source changes (only if privileged + new approved OR old approved->approved diff)
    //    (উপরে inventoryDelta/sourceDelta 0 না হলে apply হবে)
    if (
      isPrivileged &&
      (inventoryDelta !== 0 || sourceDelta !== 0) &&
      (newIsStock || oldWasStock)
    ) {
      // 4.1) source update (DamageRepair)
      if (sourceDelta !== 0) {
        const newSourceQty = Number(received.quantity || 0) + sourceDelta;

        if (newSourceQty < 0) {
          throw new ApiError(
            400,
            `Not enough stock. Available: ${Number(received.quantity || 0)}`,
          );
        }

        // source totals proportional adjust (approx) — তোমার insert-এর স্টাইল ধরে
        const newPurchaseTotal = Math.max(
          0,
          Number(received.purchase_price || 0) + perUnitPurchase * sourceDelta,
        );
        const newSaleTotal = Math.max(
          0,
          Number(received.sale_price || 0) + perUnitSale * sourceDelta,
        );

        await DamageRepair.update(
          {
            quantity: newSourceQty,
            purchase_price: newPurchaseTotal,
            sale_price: newSaleTotal,
          },
          { where: { Id: received.Id }, transaction: t },
        );
      }

      // 4.2) inventory update (InventoryMaster)
      if (inventoryDelta !== 0) {
        const inventory = await InventoryMaster.findOne({
          where: { productId: realProductId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!inventory) throw new ApiError(404, "Inventory not found");

        const newInvQty = Number(inventory.quantity || 0) + inventoryDelta;
        if (newInvQty < 0)
          throw new ApiError(400, "Inventory cannot be negative");

        await InventoryMaster.update(
          { quantity: newInvQty },
          { where: { Id: inventory.Id }, transaction: t },
        );
      }
    }

    // ✅ 5) Notification
    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
      transaction: t,
    });

    if (users.length) {
      const msg =
        newStatus === "Approved"
          ? "Damage product request approved"
          : newNote || "Damage product updated";

      await Promise.all(
        users.map((u) =>
          Notification.create(
            {
              userId: u.Id,
              message: msg,
              url: `/kafelamart.digitalever.com.bd/damage-product`,
            },
            { transaction: t },
          ),
        ),
      );
    }

    return updatedCount;
  });
};
const getAllFromDBWithoutQuery = async () => {
  const result = await DamageRepaired.findAll();

  return result;
};

const DamageRepairedService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = DamageRepairedService;
