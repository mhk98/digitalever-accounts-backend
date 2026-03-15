const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const {
  LedgerHistorySearchableFields,
} = require("./ledgerHistoryHistory.constants");

const LedgerHistory = db.LedgerHistory;

const insertIntoDB = async (data) => {
  const result = await LedgerHistory.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, name, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    andConditions.push({
      [Op.or]: LedgerHistorySearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${term}%` },
      })),
    });
  }

  if (name && String(name).trim()) {
    andConditions.push({
      name: { [Op.like]: `%${String(name).trim()}%` },
    });
  }

  if (startDate && endDate) {
    andConditions.push({
      date: { [Op.between]: [startDate, endDate] },
    });
  } else if (startDate) {
    andConditions.push({
      date: { [Op.gte]: startDate },
    });
  } else if (endDate) {
    andConditions.push({
      date: { [Op.lte]: endDate },
    });
  }

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      andConditions.push({ [key]: { [Op.eq]: value } });
    }
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const order =
    options.sortBy && options.sortOrder
      ? [[options.sortBy, String(options.sortOrder).toUpperCase()]]
      : [["createdAt", "DESC"]];

  const [data, count, totalAmount] = await Promise.all([
    LedgerHistory.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      order,
    }),
    LedgerHistory.count({ where: whereConditions }),
    LedgerHistory.sum("amount", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalAmount: totalAmount || 0, page, limit },
    data,
  };
};

const getDataById = async (id) => {
  const result = await LedgerHistory.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await LedgerHistory.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await LedgerHistory.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await LedgerHistory.findAll({
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const LedgerHistoryService = {
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = LedgerHistoryService;
