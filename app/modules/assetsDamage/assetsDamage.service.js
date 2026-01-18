const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { AssetsDamageSearchableFields } = require("./assetsDamage.constants");
const AssetsDamage = db.assetsDamage;
const AssetsPurchase = db.assetsPurchase;

const insertIntoDB = async (data) => {
  const { productId, quantity, price } = data;

  if (!quantity || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    // ✅ PurchaseProduct (তোমার schema অনুযায়ী Id/productId adjust করো)
    const purchase = await AssetsPurchase.findOne({
      where: { Id: productId }, // যদি column থাকে productId, তাহলে where: { productId }
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!purchase) throw new ApiError(404, "Received product not found");

    // ✅ stock check
    if (purchase.quantity < quantity) {
      throw new ApiError(
        400,
        `Not enough stock. Available: ${purchase.quantity}`,
      );
    }

    const oldQty = Number(purchase.quantity);
    const saleQty = Number(quantity);

    // ✅ AssetsPurchase create (return amount)
    const payload = {
      name: purchase.name,
      quantity: saleQty,
      price,
      total: price * quantity,
      productId,
    };

    const result = await AssetsDamage.create(payload, {
      transaction: t,
    });

    // ✅ AssetsPurchase update (qty & prices reduce)
    const newQty = oldQty - saleQty;

    await AssetsPurchase.update(
      {
        quantity: newQty,
        total: purchase.price * newQty,
      },
      {
        where: { Id: purchase.Id }, // যদি productId হয়: where: { productId }
        transaction: t,
      },
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
      [Op.or]: AssetsDamageSearchableFields.map((field) => ({
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

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await AssetsDamage.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await AssetsDamage.count({ where: whereConditions });

  const [count, totalQuantity] = await Promise.all([
    AssetsDamage.count({ where: whereConditions }),
    AssetsDamage.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await AssetsDamage.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await AssetsDamage.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, data) => {
  const { productId, quantity, price } = data;

  if (!quantity || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    // ✅ PurchaseProduct (তোমার schema অনুযায়ী Id/productId adjust করো)
    const purchase = await AssetsPurchase.findOne({
      where: { Id: productId }, // যদি column থাকে productId, তাহলে where: { productId }
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!purchase) throw new ApiError(404, "Received product not found");

    // ✅ stock check
    if (purchase.quantity < quantity) {
      throw new ApiError(
        400,
        `Not enough stock. Available: ${purchase.quantity}`,
      );
    }

    const oldQty = Number(purchase.quantity);
    const saleQty = Number(quantity);

    // ✅ AssetsPurchase create (return amount)
    const payload = {
      name: purchase.name,
      quantity: saleQty,
      price,
      total: price * quantity,
      productId,
    };

    const result = await AssetsDamage.update(payload, {
      where: { Id: id },
      transaction: t,
    });

    // ✅ AssetsPurchase update (qty & prices reduce)
    const newQty = oldQty - saleQty;

    await AssetsPurchase.update(
      {
        quantity: newQty,
        total: purchase.price * newQty,
      },
      {
        where: { Id: purchase.Id },
        transaction: t,
      },
    );

    return result;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await AssetsDamage.findAll();

  return result;
};

const AssetsDamageService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = AssetsDamageService;
