const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  InTransitProductSearchableFields,
} = require("./inTransitProduct.constants");
const InTransitProduct = db.inTransitProduct;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;

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

  console.log("InTransit", data);

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

    if (!inventory) throw new ApiError(404, "Received product not found");

    const oldQty = Number(inventory.quantity || 0);
    if (oldQty < returnQty) {
      throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
    }

    const perUnitPurchase =
      oldQty > 0 ? Number(inventory.purchase_price || 0) / oldQty : 0;
    const perUnitSale =
      oldQty > 0 ? Number(inventory.sale_price || 0) / oldQty : 0;

    const deductPurchase = perUnitPurchase * returnQty;
    const deductSale = perUnitSale * returnQty;

    const realProductId = Number(inventory.productId);
    if (!realProductId) {
      throw new ApiError(
        400,
        "InventoryMaster.productId missing (Products.Id)",
      );
    }

    const result = await InTransitProduct.create(
      {
        name: inventory.name,
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
          Number(inventory.purchase_price || 0) - deductPurchase,
        ),
        sale_price: Math.max(0, Number(inventory.sale_price || 0) - deductSale),
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
    await InTransitProduct.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

const updateOneFromDB = async (id, data) => {
  const {
    quantity,
    receivedId,
    note,
    date,
    status,
    userId,
    supplierId,
    warehouseId,
    actorRole,
  } = data;

  console.log("InTransit", data);

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await InTransitProduct.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status"],
  });

  if (!existing) return 0;

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

  const returnQty = Number(quantity);
  const rid = Number(receivedId);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    const inventory = await InventoryMaster.findOne({
      where: { Id: rid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!inventory) throw new ApiError(404, "Received product not found");

    const oldQty = Number(inventory.quantity || 0);
    if (oldQty < returnQty) {
      throw new ApiError(400, `Not enough stock. Available: ${oldQty}`);
    }

    const perUnitPurchase =
      oldQty > 0 ? Number(inventory.purchase_price || 0) / oldQty : 0;
    const perUnitSale =
      oldQty > 0 ? Number(inventory.sale_price || 0) / oldQty : 0;

    const deductPurchase = perUnitPurchase * returnQty;
    const deductSale = perUnitSale * returnQty;

    const realProductId = Number(inventory.productId);
    if (!realProductId) {
      throw new ApiError(
        400,
        "InventoryMaster.productId missing (Products.Id)",
      );
    }

    const [updatedCount] = await InTransitProduct.update(
      {
        name: inventory.name,
        supplierId,
        warehouseId,
        quantity: returnQty,
        purchase_price: deductPurchase,
        note: newNote || null,
        status: finalStatus,
        date: inputDateStr || undefined,
        sale_price: deductSale,
        productId: realProductId, // ✅ Products.Id (FK)
      },
      {
        where: { Id: id },
        transaction: t,
      },
    );

    if (status === "Approved") {
      await InventoryMaster.update(
        {
          quantity: oldQty - returnQty,
          purchase_price: Math.max(
            0,
            Number(inventory.purchase_price || 0) - deductPurchase,
          ),
          sale_price: Math.max(
            0,
            Number(inventory.sale_price || 0) - deductSale,
          ),
        },
        { where: { Id: inventory.Id }, transaction: t },
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
        ? "Intransit product request approved"
        : note || "Intransit product updated";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/kafelamart.digitalever.com.bd/intransit-product`,
        }),
      ),
    );
    return updatedCount;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await InTransitProduct.findAll();

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
