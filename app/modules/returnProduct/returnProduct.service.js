const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ReturnProductSearchableFields } = require("./returnProduct.constants");
const ReturnProduct = db.returnProduct;
const ReceivedProduct = db.receivedProduct;

const insertIntoDB = async (data) => {
  const { quantity, productId } = data;

  if (!quantity || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    // ✅ ReceivedProduct (তোমার schema অনুযায়ী Id/productId adjust করো)
    const received = await ReceivedProduct.findOne({
      where: { Id: productId }, // যদি column থাকে productId, তাহলে where: { productId }
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) throw new ApiError(404, "Received product not found");

    // ✅ stock check
    // if (received.quantity < quantity) {
    //   throw new ApiError(
    //     400,
    //     `Not enough stock. Available: ${received.quantity}`,
    //   );
    // }

    /**
     * ✅ per unit price বের করা
     * received.purchase_price / received.quantity (old quantity)
     */
    const oldQty = Number(received.quantity);
    const perUnitPurchase =
      oldQty > 0 ? Number(received.purchase_price) / oldQty : 0;
    const perUnitSale = oldQty > 0 ? Number(received.sale_price) / oldQty : 0;

    const returnQty = Number(quantity);

    const deductPurchase = perUnitPurchase * returnQty;
    const deductSale = perUnitSale * returnQty;

    // ✅ InTransitProduct create (return amount)
    const payload = {
      name: received.name,
      supplier: received.supplier,
      quantity: returnQty,
      purchase_price: deductPurchase,
      sale_price: deductSale,
      productId,
    };

    const result = await ReturnProduct.create(payload, {
      transaction: t,
    });

    // ✅ ReceivedProduct update (qty & prices reduce)
    const newQty = oldQty + returnQty;
    const newPurchase = Math.max(
      0,
      Number(received.purchase_price) + deductPurchase,
    );
    const newSale = Math.max(0, Number(received.sale_price) + deductSale);

    await ReceivedProduct.update(
      {
        quantity: newQty,
        purchase_price: newPurchase,
        sale_price: newSale,
      },
      {
        where: { Id: received.Id },
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
      createdAt: { [Op.between]: [start, end] },
    });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await ReturnProduct.findAll({
    where: whereConditions,
    offset: skip,
    limit,
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
  const result = await ReturnProduct.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, data) => {
  const { quantity, productId } = data;

  if (!quantity || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    // ✅ ReceivedProduct (তোমার schema অনুযায়ী Id/productId adjust করো)
    const received = await ReceivedProduct.findOne({
      where: { Id: productId }, // যদি column থাকে productId, তাহলে where: { productId }
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) throw new ApiError(404, "Received product not found");

    // ✅ stock check
    // if (received.quantity < quantity) {
    //   throw new ApiError(
    //     400,
    //     `Not enough stock. Available: ${received.quantity}`,
    //   );
    // }

    /**
     * ✅ per unit price বের করা
     * received.purchase_price / received.quantity (old quantity)
     */
    const oldQty = Number(received.quantity);
    const perUnitPurchase =
      oldQty > 0 ? Number(received.purchase_price) / oldQty : 0;
    const perUnitSale = oldQty > 0 ? Number(received.sale_price) / oldQty : 0;

    const returnQty = Number(quantity);

    const deductPurchase = perUnitPurchase * returnQty;
    const deductSale = perUnitSale * returnQty;

    // ✅ InTransitProduct create (return amount)
    const payload = {
      name: received.name,
      supplier: received.supplier,
      quantity: returnQty,
      purchase_price: deductPurchase,
      sale_price: deductSale,
      productId,
    };

    const result = await ReturnProduct.update(payload, {
      where: { Id: id },
      transaction: t,
    });

    // ✅ ReceivedProduct update (qty & prices reduce)
    const newQty = oldQty + returnQty;
    const newPurchase = Math.max(
      0,
      Number(received.purchase_price) + deductPurchase,
    );
    const newSale = Math.max(0, Number(received.sale_price) + deductSale);

    await ReceivedProduct.update(
      {
        quantity: newQty,
        purchase_price: newPurchase,
        sale_price: newSale,
      },
      {
        where: { Id: received.Id },
        transaction: t,
      },
    );

    return result;
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
