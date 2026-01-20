const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { CashInOutSearchableFields } = require("./cashInOut.constants");
const CashInOut = db.cashInOut;

const insertIntoDB = async (data) => {
  const result = await CashInOut.create(data);
  return result;
};

// const getAllFromDB = async (filters, options) => {
//   const { page, limit, skip } = paginationHelpers.calculatePagination(options);

//   const { searchTerm, startDate, endDate, ...otherFilters } = filters;

//   const andConditions = [];

//   // ✅ Search (ILIKE on searchable fields)
//   if (searchTerm && searchTerm.trim()) {
//     andConditions.push({
//       [Op.or]: CashInOutSearchableFields.map((field) => ({
//         [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
//       })),
//     });
//   }

//   // ✅ Exact filters (e.g. name)
//   if (Object.keys(otherFilters).length) {
//     andConditions.push(
//       ...Object.entries(otherFilters).map(([key, value]) => ({
//         [key]: { [Op.eq]: value },
//       }))
//     );
//   }

//   // ✅ Date range filter (createdAt)
//   if (startDate && endDate) {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     andConditions.push({
//       createdAt: { [Op.between]: [start, end] },
//     });
//   }

//   const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

//   const result = await CashInOut.findAll({
//     where: whereConditions,
//     offset: skip,
//     limit,
//     order:
//       options.sortBy && options.sortOrder
//         ? [[options.sortBy, options.sortOrder.toUpperCase()]]
//         : [["createdAt", "DESC"]],
//   });

//   const total = await CashInOut.count({ where: whereConditions });

//   return {
//     meta: { total, page, limit },
//     data: result,
//   };
// };

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const {
    searchTerm,
    startDate,
    endDate,
    paymentMode,
    paymentStatus,
    bookId,
    ...otherFilters
  } = filters;

  const andConditions = [];

  // ✅ searchTerm -> ILIKE on searchable fields
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: CashInOutSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ exact filters
  if (paymentMode) {
    andConditions.push({ paymentMode: { [Op.eq]: paymentMode } });
  }
  if (paymentStatus) {
    andConditions.push({ paymentStatus: { [Op.eq]: paymentStatus } });
  }
  if (bookId) {
    andConditions.push({ bookId: { [Op.eq]: bookId } });
  }

  // ✅ date range
  if (startDate && endDate) {
    andConditions.push({
      createdAt: {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      },
    });
  } else if (startDate) {
    andConditions.push({
      createdAt: {
        [Op.gte]: new Date(startDate),
      },
    });
  } else if (endDate) {
    andConditions.push({
      createdAt: {
        [Op.lte]: new Date(endDate),
      },
    });
  }

  // ✅ any other exact filters
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

  const data = await CashInOut.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await CashInOut.count({ where: whereConditions });
  const [count, totalCashIn, totalCashOut] = await Promise.all([
    CashInOut.count({ where: whereConditions }),
    CashInOut.sum("amount", {
      where: { ...whereConditions, paymentStatus: "CashIn" },
    }),
    CashInOut.sum("amount", {
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
    data,
  };
};

const getDataById = async (id) => {
  const result = await CashInOut.findAll({
    where: {
      bookId: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await CashInOut.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const {} = payload;
  const result = await CashInOut.update(payload, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await CashInOut.findAll();

  return result;
};

const CashInOutService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = CashInOutService;
