const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const {
  InTransitStockSearchableFields,
} = require("./inTransitStock.constants");

const InTransitStock = db.inTransitStock;

const insertIntoDB = async (data) => {
  const result = await InTransitStock.create(data);

  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: InTransitStockSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      createdAt: { [Op.between]: [start, end] },
    });
  }

  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const data = await InTransitStock.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const [count, totalQuantity] = await Promise.all([
    InTransitStock.count({ where: whereConditions }),
    InTransitStock.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: {
      count,
      totalQuantity: totalQuantity || 0,
      page,
      limit,
    },
    data,
  };
};

const getDataById = async (id) => {
  const result = await InTransitStock.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await InTransitStock.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await InTransitStock.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await InTransitStock.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const InTransitStockService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = InTransitStockService;
