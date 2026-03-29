const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  DamageRepairedSearchableFields,
} = require("./damageRepaired.constants");
const mergeVariants = require("../../../shared/mergeVariants");
const parseVariants = require("../../../shared/parseVariants");
const subtractVariants = require("../../../shared/subtractVariants");
const DamageRepaired = db.damageRepaired;
const DamageRepair = db.damageRepair;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;
const DamageReparingStock = db.damageReparingStock;

const findDamageReparingStockByReference = async (receivedId, transaction) => {
  const byId = await DamageReparingStock.findOne({
    where: { Id: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (byId) return byId;

  return DamageReparingStock.findOne({
    where: { productId: receivedId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
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

  console.log("Damage", data);

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

    const damageRepairId = Number(damageRepair.Id);
    if (!damageRepairId) {
      throw new ApiError(400, "DamageRepair.Id missing");
    }

    const damageStockId = Number(damageRepair.productId);
    if (!damageStockId) {
      throw new ApiError(
        400,
        "DamageRepair productId missing (DamageStock.Id)",
      );
    }

    const damageStock = await db.damageStock.findOne({
      where: { Id: damageStockId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!damageStock) {
      throw new ApiError(404, "DamageStock not found");
    }

    const catalogProductId = Number(damageStock.productId);
    if (!catalogProductId) {
      throw new ApiError(400, "DamageStock.productId missing (Products.Id)");
    }

    const result = await DamageRepaired.create(
      {
        name: damageRepair.name,
        supplierId,
        warehouseId,
        source: "Damage Repaired",
        remarks: damageRepair.remarks,
        quantity: returnQty,
        variants: incomingVariants,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        productId: damageRepairId,
        status: finalStatus || "---",
        note: note || null,
        date: date,
      },
      { transaction: t },
    );

    const damageReparingStock = await DamageReparingStock.findOne({
      where: { productId: catalogProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!damageReparingStock) {
      throw new ApiError(404, "DamageReparingStock not found");
    }

    const repairingQty = Number(damageReparingStock.quantity || 0);
    if (repairingQty < returnQty) {
      throw new ApiError(
        400,
        `Not enough repairing stock. Available: ${repairingQty}`,
      );
    }

    await DamageReparingStock.update(
      {
        quantity: repairingQty - returnQty,
        variants: subtractVariants(
          damageReparingStock.variants,
          incomingVariants,
        ),
      },
      { where: { Id: damageReparingStock.Id }, transaction: t },
    );

    const inventory = await InventoryMaster.findOne({
      where: { productId: catalogProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!inventory) throw new ApiError(404, "Inventory product not found");

    const receivedOldQty = Number(inventory.quantity || 0);

    // 3) Update InventoryMaster (plus repaired items)
    await InventoryMaster.update(
      {
        quantity: receivedOldQty + returnQty,
        variants: mergeVariants(inventory.variants, incomingVariants),
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
      attributes: [
        "Id",
        "productId",
        "quantity",
        "purchase_price",
        "sale_price",
        "variants",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");

    const qty = Number(ret.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    const damageRepair = await DamageRepair.findOne({
      where: { Id: ret.productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!damageRepair) {
      throw new ApiError(404, "DamageRepair product not found");
    }

    const damageStock = await db.damageStock.findOne({
      where: { Id: damageRepair.productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!damageStock) {
      throw new ApiError(404, "DamageStock product not found");
    }

    const catalogProductId = Number(damageStock.productId);
    if (!catalogProductId) {
      throw new ApiError(400, "DamageStock.productId missing (Products.Id)");
    }

    const received = await DamageReparingStock.findOne({
      where: { productId: catalogProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received)
      throw new ApiError(404, "DamageReparingStock product not found");

    await DamageReparingStock.update(
      {
        quantity: Number(received.quantity || 0) + qty,
        variants: mergeVariants(received.variants, ret.variants),
      },
      { where: { Id: received.Id }, transaction: t },
    );

    const inventory = await InventoryMaster.findOne({
      where: { productId: received.productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const finalQuantity = Number(inventory.quantity || 0) - qty;
    if (finalQuantity < 0) {
      throw new ApiError(400, "Inventory cannot be negative");
    }
    await InventoryMaster.update(
      {
        quantity: finalQuantity,
        variants: subtractVariants(inventory.variants, ret.variants),
      },
      { where: { Id: inventory.Id }, transaction: t },
    );

    // 4) Return row delete
    await DamageRepaired.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

const updateOneFromDB = async (id, data) => {
  const {
    quantity,
    receivedId, // এটা DamageRepair.Id (source)
    variants,
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
  const incomingVariants = parseVariants(variants);

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
      attributes: ["Id", "quantity", "status", "note", "productId", "variants"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existingRepaired) return 0;

    const oldRepairedQty = Number(existingRepaired.quantity || 0);
    const oldRepairedStatus = String(existingRepaired.status || "").trim();
    const oldProductId = Number(existingRepaired.productId);
    const existingVariants = parseVariants(existingRepaired.variants);

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

    const oldDamageRepair = await DamageRepair.findOne({
      where: { Id: oldProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldDamageRepair) {
      throw new ApiError(404, "Old DamageRepair not found");
    }

    const oldDamageStockId = Number(oldDamageRepair.productId);
    if (!oldDamageStockId) {
      throw new ApiError(400, "Old DamageRepair.productId missing");
    }

    const oldDamageStock = await db.damageStock.findOne({
      where: { Id: oldDamageStockId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldDamageStock) {
      throw new ApiError(404, "Old DamageStock not found");
    }

    const oldCatalogProductId = Number(oldDamageStock.productId);
    if (!oldCatalogProductId) {
      throw new ApiError(400, "Old DamageStock.productId missing");
    }

    const received = await DamageRepair.findOne({
      where: { Id: rid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) throw new ApiError(404, "DamageRepair product not found");

    const damageRepairId = Number(received.Id);
    if (!damageRepairId) {
      throw new ApiError(400, "DamageRepair.Id missing");
    }

    const targetDamageStockId = Number(received.productId);
    if (!targetDamageStockId) {
      throw new ApiError(
        400,
        "DamageRepair.productId missing (DamageStock.Id)",
      );
    }

    const targetDamageStock = await db.damageStock.findOne({
      where: { Id: targetDamageStockId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!targetDamageStock) {
      throw new ApiError(404, "DamageStock not found");
    }

    const targetCatalogProductId = Number(targetDamageStock.productId);
    if (!targetCatalogProductId) {
      throw new ApiError(400, "DamageStock.productId missing (Products.Id)");
    }

    const oldDamageReparingStock = await DamageReparingStock.findOne({
      where: { productId: oldCatalogProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldDamageReparingStock) {
      throw new ApiError(404, "DamageReparingStock not found");
    }

    await oldDamageReparingStock.update(
      {
        quantity: Number(oldDamageReparingStock.quantity || 0) + oldRepairedQty,
        variants: mergeVariants(
          oldDamageReparingStock.variants,
          existingVariants,
        ),
      },
      { transaction: t },
    );

    const oldInventory = await InventoryMaster.findOne({
      where: { productId: oldCatalogProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldInventory) throw new ApiError(404, "Inventory not found");

    const rolledBackInventoryQty =
      Number(oldInventory.quantity || 0) - oldRepairedQty;
    if (rolledBackInventoryQty < 0) {
      throw new ApiError(400, "Inventory cannot be negative");
    }

    await oldInventory.update(
      {
        quantity: rolledBackInventoryQty,
        variants: subtractVariants(oldInventory.variants, existingVariants),
      },
      { transaction: t },
    );

    let targetDamageReparingStock = oldDamageReparingStock;
    let targetInventory = oldInventory;
    if (damageRepairId !== oldProductId) {
      targetDamageReparingStock = await findDamageReparingStockByReference(
        targetCatalogProductId,
        t,
      );
      targetInventory = await InventoryMaster.findOne({
        where: { productId: targetCatalogProductId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
    }

    if (!targetDamageReparingStock) {
      throw new ApiError(404, "DamageReparingStock product not found");
    }
    if (!targetInventory) throw new ApiError(404, "Inventory not found");

    const availableDamageQty = Number(targetDamageReparingStock.quantity || 0);
    if (availableDamageQty < returnQty) {
      throw new ApiError(
        400,
        `Not enough repairing stock. Available: ${availableDamageQty}`,
      );
    }

    const perUnitPurchase =
      availableDamageQty > 0
        ? Number(received.purchase_price || 0) / Number(received.quantity || 0)
        : 0;
    const perUnitSale =
      availableDamageQty > 0
        ? Number(received.sale_price || 0) / Number(received.quantity || 0)
        : 0;

    const deductPurchaseNew = perUnitPurchase * returnQty;
    const deductSaleNew = perUnitSale * returnQty;

    const [updatedCount] = await DamageRepaired.update(
      {
        name: received.name,
        supplierId,
        warehouseId,
        remarks: received.remarks,
        quantity: returnQty,
        variants: incomingVariants,
        purchase_price: deductPurchaseNew,
        sale_price: deductSaleNew,
        note: newNote || null,
        status: finalStatus,
        date: inputDateStr || undefined,
        productId: damageRepairId,
      },
      { where: { Id: id }, transaction: t },
    );

    const newDamageQty = availableDamageQty - returnQty;
    if (newDamageQty < 0) {
      throw new ApiError(400, "DamageReparingStock cannot be negative");
    }

    await targetDamageReparingStock.update(
      {
        quantity: newDamageQty,
        variants: subtractVariants(
          targetDamageReparingStock.variants,
          incomingVariants,
        ),
      },
      { transaction: t },
    );

    await targetInventory.update(
      {
        quantity: Number(targetInventory.quantity || 0) + returnQty,
        variants: mergeVariants(targetInventory.variants, incomingVariants),
      },
      { transaction: t },
    );

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

// const updateOneFromDB = async (id, data) => {
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
//   } = data;

//   console.log("Damage", data);

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10);

//   // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
//   const existing = await DamageRepaired.findOne({
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
//     const received = await DamageStock.findOne({
//       where: { Id: rid },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     if (!received) throw new ApiError(404, "Received product not found");

//     const oldQty = Number(received.quantity || 0);

//     // if (oldQty < returnQty) {
//     //   throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
//     // }

//     const perUnitPurchase =
//       oldQty > 0 ? Number(received.purchase_price || 0) / oldQty : 0;
//     const perUnitSale =
//       oldQty > 0 ? Number(received.sale_price || 0) / oldQty : 0;

//     const deductPurchase = perUnitPurchase * returnQty;
//     const deductSale = perUnitSale * returnQty;

//     const realProductId = Number(received.productId);
//     if (!realProductId) {
//       throw new ApiError(400, "DamageStock.productId missing (Products.Id)");
//     }

//     const existing = await DamageRepaired.findOne({
//       where: { Id: id },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     const data = {
//       name: received.name,
//       supplierId,
//       warehouseId,
//       remarks: received.remarks,
//       quantity: returnQty,
//       purchase_price: received.purchase_price * returnQty,
//       sale_price: received.sale_price * returnQty,
//       note: newNote || null,
//       status: finalStatus,
//       date: inputDateStr || undefined,
//       productId: realProductId, // ✅ Products.Id (FK)
//     };

//     const [updatedCount] = await DamageRepaired.update(data, {
//       where: { Id: id },
//       transaction: t,
//     });

//     let receivedFinalQty = 0;
//     if (Number(existing.quantity) > Number(quantity)) {
//       receivedFinalQty = Number(existing.quantity) - Number(quantity);
//     } else {
//       receivedFinalQty = Number(quantity) - Number(existing.quantity);
//     }

//     if (existing) {
//       let stockQuantity = 0;
//       if (Number(existing.quantity) > Number(quantity)) {
//         stockQuantity = Number(existing.quantity) + Number(receivedFinalQty);
//       } else {
//         stockQuantity = Number(existing.quantity) - Number(receivedFinalQty);
//       }

//       // চাইলে negative prevent করতে পারেন
//       if (stockQuantity < 0)
//         throw new ApiError(
//           400,
//           "Damage stock not enough product for this update",
//         );

//       // const oldQty = Number(inv.quantity);
//       // const perUnitPurchase =
//       //   oldQty > 0 ? Number(inv.purchase_price || 0) / oldQty : 0;
//       // const perUnitSale = oldQty > 0 ? Number(inv.sale_price || 0) / oldQty : 0;

//       await DamageStock.update(
//         {
//           quantity: stockQuantity,
//         },
//         { where: { Id: received.Id }, transaction: t },
//       );
//     }

//      const existingMasterInventory = await InventoryMaster.findOne({
//       where: { productId: existing.productId },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//      let masterFinalQty = 0;
//     if (Number(existing.quantity) > Number(quantity)) {
//       masterFinalQty = Number(existing.quantity) - Number(quantity);
//     } else {
//       masterFinalQty = Number(quantity) - Number(existing.quantity);
//     }

//     if (existing) {
//       let stockQuantity = 0;
//       if (Number(existingMasterInventory.quantity) > Number(masterFinalQty)) {
//         stockQuantity = Number(existingMasterInventory.quantity) + Number(masterFinalQty);
//       } else {
//         stockQuantity = Number(existingMasterInventory.quantity) - Number(masterFinalQty);
//       }

//     await InventoryMaster.update(
//       {
//         quantity: stockQuantity,
//         purchase_price: Number(existingMasterInventory.purchase_price * stockQuantity || 0),

//         sale_price:
//           Number(existingMasterInventory.sale_price * stockQuantity || 0),
//       },
//       { where: { Id: existingMasterInventory.Id }, transaction: t },
//     );

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
