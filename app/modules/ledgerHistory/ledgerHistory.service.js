const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const { LedgerHistorySearchableFields } = require("./ledgerHistory.constants");
const LedgerHistory = db.ledgerHistory;
const Ledger = db.ledger;
const CashInOut = db.cashInOut;

const normalizeOptionalForeignKey = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  return value;
};

const insertIntoDB = async (payload) => {
  const {
    cashType,
    paidAmount,
    ledgerId,
    unpaidAmount,
    note,
    date,
    supplierId,
    employeeId,
  } = payload;

  const data = {
    paidAmount,
    unpaidAmount,
    status: cashType,
    ledgerId,
    supplierId: normalizeOptionalForeignKey(supplierId),
    employeeId: normalizeOptionalForeignKey(employeeId),
    note,
    date,
  };

  return db.sequelize.transaction(async (t) => {
    if (supplierId) {
      // SupplierHistory
      await SupplierHistory.create(
        {
          supplierId,
          bookId,
          amount,
          status: cashType,
          date: date || new Date(),
          note: note || "",
        },
        { transaction: t },
      );
      // CashInOut
      await CashInOut.create(
        {
          supplierId,
          bookId,
          paymentStatus: cashType === "Paid" ? "CashIn" : "Unpaid",
          amount,
          date,
          file,
        },
        { transaction: t },
      );
    }

    if (employeeId) {
      // CashInOut
      await CashInOut.create(
        {
          employeeId,
          bookId,
          paymentStatus: cashType === "Paid" ? "CashIn" : "Unpaid",
          amount,
          date,
        },
        { transaction: t },
      );
    }

    const result = await LedgerHistory.create(data);

    return result;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, name, ...otherFilters } = filters;

  const andConditions = [];
  const normalizedOtherFilters = {};

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (key === "supplierId" || key === "employeeId") {
      const normalizedValue = normalizeOptionalForeignKey(value);

      if (normalizedValue !== null) {
        normalizedOtherFilters[key] = normalizedValue;
      }

      return;
    }

    if (value !== undefined && value !== null && value !== "") {
      normalizedOtherFilters[key] = value;
    }
  });

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
  if (Object.keys(normalizedOtherFilters).length) {
    andConditions.push(
      ...Object.entries(normalizedOtherFilters).map(([key, value]) => ({
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

  const [result, count, totalPaidAmount, totalUnpaidAmount] = await Promise.all([
    LedgerHistory.findAll({
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
    }),
    LedgerHistory.count({
      where: whereConditions,
    }),
    LedgerHistory.sum("paidAmount", {
      where: whereConditions,
    }),
    LedgerHistory.sum("unpaidAmount", {
      where: whereConditions,
    }),
  ]);

  const paid = Number(totalPaidAmount) || 0;
  const unpaid = Number(totalUnpaidAmount) || 0;
  const netBalance = unpaid - paid;

  return {
    meta: { count, page, limit, paid, unpaid, netBalance },
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
  const normalizedPayload = {
    ...payload,
    supplierId: normalizeOptionalForeignKey(payload?.supplierId),
    employeeId: normalizeOptionalForeignKey(payload?.employeeId),
  };

  const result = await LedgerHistory.update(normalizedPayload, {
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
