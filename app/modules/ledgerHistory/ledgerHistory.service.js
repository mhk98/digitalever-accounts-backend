const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const { LedgerHistorySearchableFields } = require("./ledgerHistory.constants");

const LedgerHistory = db.ledgerHistory;
const Ledger = db.ledger;

const insertIntoDB = async (payload) => {
  const { cashType, paidAmount, ledgerId, unpaidAmount, note, date } = payload;

  const data = {
    paidAmount,
    unpaidAmount,
    status: cashType,
    ledgerId,
    note,
    date,
  };
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

  // if (name && String(name).trim()) {
  //   andConditions.push({
  //     name: { [Op.like]: `%${String(name).trim()}%` },
  //   });
  // }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
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

  // const [ count, totalAmount] = await Promise.all([
  //   LedgerHistory.findAll({
  //     where: whereConditions,
  //     offset: skip,
  //     limit,
  //     order,
  //   }),
  //   LedgerHistory.count({ where: whereConditions }),
  //   LedgerHistory.sum("amount", { where: whereConditions }),
  // ]);

  const result = await LedgerHistory.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: [
      {
        model: Ledger,
        as: "ledger",
        attributes: ["Id", "name"],
      },
    ],
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["date", "DESC"]],
  });

  return {
    meta: { page, limit },
    data: result,
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
