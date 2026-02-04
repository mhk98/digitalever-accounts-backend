const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  DamageRepairedSearchableFields,
} = require("./damageRepaired.constants");
const DamageRepaired = db.damageRepaired;
const DamageRepair = db.damageRepair;
const DamageProduct = db.damageProduct;
const ReceivedProduct = db.receivedProduct;
const Notification = db.notification;
const User = db.user;

const insertIntoDB = async (data) => {
  const { quantity, receivedId } = data;

  console.log("Damage", data);

  const returnQty = Number(quantity);
  const rid = Number(receivedId);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    const damageRepair = await DamageRepair.findOne({
      where: { Id: rid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

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

    const realDamageProductId = Number(damageRepair.productId);
    if (!realDamageProductId) {
      throw new ApiError(400, "DamageRepair productId missing (Products.Id)");
    }

    const result = await DamageRepaired.create(
      {
        name: damageRepair.name,
        supplier: damageRepair.supplier,
        remarks: damageRepair.remarks,
        quantity: returnQty,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        productId: realDamageProductId, // ✅ Products.Id (FK)
      },
      { transaction: t },
    );

    await DamageRepair.update(
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

    const damageProduct = await DamageProduct.findOne({
      where: { Id: realDamageProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!damageProduct) throw new ApiError(404, "Damage product not found");

    const receivedProduct = await ReceivedProduct.findOne({
      where: { Id: damageProduct.productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!receivedProduct) throw new ApiError(404, "Damage product not found");

    const receivedOldQty = Number(receivedProduct.quantity || 0);

    const realreceivedProductId = Number(receivedOldQty.Id);
    if (!realDamageProductId) {
      throw new ApiError(400, "DamageRepair productId missing (Products.Id)");
    }

    await ReceivedProduct.update(
      {
        quantity: receivedOldQty + returnQty,
      },
      { where: { Id: receivedProduct.Id }, transaction: t },
    );

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

  const result = await DamageRepaired.findAll({
    where: whereConditions,
    offset: skip,
    limit,
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

    // 2) ReceivedProduct খুঁজে বের করো (Products.Id দিয়ে)
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
    const received = await DamageRepair.findOne({
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
      throw new ApiError(400, "DamageRepair.productId missing (Products.Id)");
    }

    const [updatedCount] = await DamageRepaired.update(
      {
        name: received.name,
        supplier: received.supplier,
        remarks: received.remarks,
        quantity: returnQty,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        note: status === "Approved" ? "-" : note,
        status: status ? status : "Pending",
        productId: realProductId, // ✅ Products.Id (FK)
      },
      {
        where: { Id: id },
        transaction: t,
      },
    );

    if (status === "Approved") {
      await DamageRepair.update(
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
