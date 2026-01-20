const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { MetaSearchableFields } = require("./meta.constants");
const Meta = db.meta;

const insertIntoDB = async (data) => {
  console.log("meta", data);
  const result = await Meta.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: MetaSearchableFields.map((field) => ({
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

  const result = await Meta.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await Meta.count({ where: whereConditions });
  // ✅ total count + total quantity (same filters)
  const [count, totalAmount] = await Promise.all([
    Meta.count({ where: whereConditions }),
    Meta.sum("amount", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalAmount: totalAmount || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await Meta.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Meta.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const { note, status, amount } = payload;

  const data = {
    note: status === "Approved" ? "-" : note,
    status: status ? status : "Pending",
    amount,
  };
  const result = await Meta.update(data, {
    where: {
      Id: id,
    },
  });

  return result;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Meta.findAll();

  return result;
};

const MetaService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = MetaService;
