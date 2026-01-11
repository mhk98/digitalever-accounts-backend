const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { PayableSearchableFields } = require("./payable.constants");
const Payable = db.payable;

const insertIntoDB = async (data) => {
  const result = await Payable.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, name, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (MySQL/MariaDB): LIKE
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    andConditions.push({
      [Op.or]: (PayableSearchableFields || []).map((field) => ({
        [field]: { [Op.like]: `%${term}%` },
      })),
    });
  }

  // ✅ Optional direct name filter (also LIKE)
  if (name && String(name).trim()) {
    const term = String(name).trim();
    andConditions.push({
      name: { [Op.like]: `%${term}%` },
    });
  }

  // ✅ Date range filter on createdAt
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // include full end day

    andConditions.push({
      createdAt: { [Op.between]: [start, end] },
    });
  } else if (startDate) {
    const start = new Date(startDate);
    andConditions.push({
      createdAt: { [Op.gte]: start },
    });
  } else if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    andConditions.push({
      createdAt: { [Op.lte]: end },
    });
  }

  // ✅ Other exact filters (eq)
  if (Object.keys(otherFilters).length) {
    Object.entries(otherFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        andConditions.push({ [key]: { [Op.eq]: value } });
      }
    });
  }

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const order =
    options.sortBy && options.sortOrder
      ? [[options.sortBy, String(options.sortOrder).toUpperCase()]]
      : [["createdAt", "DESC"]];

  const data = await Payable.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    order,
  });

  const total = await Payable.count({ where: whereConditions });

  return {
    meta: { total, page, limit },
    data,
  };
};

module.exports = {
  getAllFromDB,
};

const getDataById = async (id) => {
  const result = await Payable.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Payable.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const { name } = payload;
  const result = await Payable.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Payable.findAll();

  return result;
};

const PayableService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PayableService;
