const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { AssetsDamageSearchableFields } = require("./assetsDamage.constants");
const AssetsDamage = db.assetsDamage;
const AssetsPurchase = db.assetsPurchase;

const insertIntoDB = async (payload) => {
  const { productId, quantity, price } = payload;

  const productData = await AssetsPurchase.findOne({
    where: { Id: productId },
  });
  const data = {
    name: productData.name,
    quantity,
    price,
    total: Number(price * quantity),
  };
  const result = await AssetsDamage.create(data);
  return result;
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
      }))
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

  const total = await AssetsDamage.count({ where: whereConditions });

  return {
    meta: { total, page, limit },
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

const updateOneFromDB = async (id, payload) => {
  const { productId, quantity, price } = payload;

  const productData = await AssetsPurchase.findOne({
    where: { Id: productId },
  });
  const data = {
    name: productData.name,
    quantity,
    price,
    total: Number(price * quantity),
  };

  const result = await AssetsDamage.update(data, {
    where: {
      Id: id,
    },
  });

  return result;
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
