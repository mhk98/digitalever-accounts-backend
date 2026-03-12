const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const { LedgerSearchableFields } = require("./ledger.constants");

const Ledger = db.ledger;

const insertIntoDB = async (data) => {
  const result = await Ledger.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const {
    searchTerm,
    startDate,
    endDate,
    name,
    ...otherFilters
  } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    andConditions.push({
      [Op.or]: LedgerSearchableFields.map((field) => ({
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
    Ledger.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      order,
    }),
    Ledger.count({ where: whereConditions }),
    Ledger.sum("amount", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalAmount: totalAmount || 0, page, limit },
    data,
  };
};

const getDataById = async (id) => {
  const result = await Ledger.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const result = await Ledger.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Ledger.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Ledger.findAll({
    order: [["createdAt", "DESC"]],
  });

  return result;
};

const LedgerService = {
  insertIntoDB,
  getAllFromDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = LedgerService;
