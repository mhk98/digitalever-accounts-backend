const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ReturnProductSearchableFields } = require("./returnProduct.constants");
const ReturnProduct = db.returnProduct;
const ReceivedProduct = db.receivedProduct;

const insertIntoDB = async (data) => {
  const { quantity, receivedId } = data;

  console.log("Return", data);

  const returnQty = Number(quantity);
  const rid = Number(receivedId);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    const received = await ReceivedProduct.findOne({
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
      throw new ApiError(
        400,
        "ReceivedProduct.productId missing (Products.Id)",
      );
    }

    const result = await ReturnProduct.create(
      {
        name: received.name,
        supplier: received.supplier,
        quantity: returnQty,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        productId: realProductId, // ✅ Products.Id (FK)
      },
      { transaction: t },
    );

    await ReceivedProduct.update(
      {
        quantity: oldQty + returnQty,
        purchase_price: Math.max(
          0,
          Number(received.purchase_price || 0) - deductPurchase,
        ),
        sale_price: Math.max(0, Number(received.sale_price || 0) - deductSale),
      },
      { where: { Id: received.Id }, transaction: t },
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

const updateOneFromDB = async (id, data) => {
  const { quantity, receivedId, note, status } = data;

  console.log("Return", data);

  const returnQty = Number(quantity);
  const rid = Number(receivedId);

  if (!rid) throw new ApiError(400, "receivedId is required");
  if (!returnQty || returnQty <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    const received = await ReceivedProduct.findOne({
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
      throw new ApiError(
        400,
        "ReceivedProduct.productId missing (Products.Id)",
      );
    }

    const result = await ReturnProduct.update(
      {
        name: received.name,
        supplier: received.supplier,
        quantity: returnQty,
        purchase_price: deductPurchase,
        sale_price: deductSale,
        productId: realProductId, // ✅ Products.Id (FK)
        note: status === "Approved" ? "-" : note,
        status: status ? status : "Pending",
      },
      {
        where: { Id: id },
        transaction: t,
      },
    );

    if (status === "Approved") {
      await ReceivedProduct.update(
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
