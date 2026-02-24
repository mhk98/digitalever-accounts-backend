const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  PurchaseReturnProductSearchableFields,
} = require("./purchaseReturnProduct.constants");
const PurchaseReturnProduct = db.purchaseReturnProduct;
const ReceivedProduct = db.receivedProduct;
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
    status,
    note,
    userId,
    supplierId,
    warehouseId,
  } = data;

  console.log("purchaseReturn", data);

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
      where: { Id: rid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!inventory) throw new ApiError(404, "Product not found in inventory");

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
      throw new ApiError(400, "inventory.productId missing (Products.Id)");
    }

    const result = await PurchaseReturnProduct.create(
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
      [Op.or]: PurchaseReturnProductSearchableFields.map((field) => ({
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

  const result = await PurchaseReturnProduct.findAll({
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

  // const total = await PurchaseReturnProduct.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    PurchaseReturnProduct.count({ where: whereConditions }),
    PurchaseReturnProduct.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await PurchaseReturnProduct.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await PurchaseReturnProduct.findOne({
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
    await PurchaseReturnProduct.destroy({
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
    status,
    date,
    userId,
    supplierId,
    warehouseId,
    actorRole,
  } = data;

  console.log("purchaseReturn", data);

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await PurchaseReturnProduct.findOne({
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
      throw new ApiError(400, "inventory.productId missing (Products.Id)");
    }

    const [updatedCount] = await PurchaseReturnProduct.update(
      {
        name: inventory.name,
        supplierId,
        warehouseId,
        quantity: returnQty,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        productId: realProductId, // ✅ Products.Id (FK)
        note: newNote || null,
        status: finalStatus,
        date: inputDateStr || undefined,
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
        ? "Purchase return product request approved"
        : note || "Purchase return product updated";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/kafelamart.digitalever.com.bd/purchase-return`,
        }),
      ),
    );
    return updatedCount;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await PurchaseReturnProduct.findAll();

  return result;
};

const PurchaseReturnProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PurchaseReturnProductService;
