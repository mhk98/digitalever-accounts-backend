const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { pettyCashSearchableFields } = require("./pettyCash.constants");
const PettyCash = db.pettyCash;

const insertIntoDB = async (data) => {
  console.log("PettyCash", data);
  const result = await PettyCash.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: pettyCashSearchableFields.map((field) => ({
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

  const result = await PettyCash.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await PettyCash.count({ where: whereConditions });

  // ✅ total count + total quantity (same filters)

  const [count, totalCashIn, totalCashOut] = await Promise.all([
    PettyCash.count({ where: whereConditions }),
    PettyCash.sum("amount", {
      where: { ...whereConditions, paymentStatus: "CashIn" },
    }),
    PettyCash.sum("amount", {
      where: { ...whereConditions, paymentStatus: "CashOut" },
    }),
  ]);

  const cashIn = Number(totalCashIn || 0);
  const cashOut = Number(totalCashOut || 0);
  const netBalance = cashIn - cashOut;

  return {
    meta: {
      count,
      totalCashIn: cashIn,
      totalCashOut: cashOut,
      netBalance,
      page,
      limit,
    },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await PettyCash.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await PettyCash.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await PettyCash.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await PettyCash.findAll();

  return result;
};

const PettyCashService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PettyCashService;
