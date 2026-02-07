const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { MetaSearchableFields } = require("./meta.constants");
const Meta = db.meta;
const Notification = db.notification;
const User = db.user;

const insertIntoDB = async (data) => {
  const { date, note, status, amount, platform, userId } = data;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  // ✅ Approved হলে পুরোনো date-ও allow + save
  const isApproved = String(status || "").trim() === "Approved";

  // ✅ current date না হলে auto Pending
  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : null;

  const result = await Meta.create({
    status: finalStatus || "---",
    note: note || "---",
    date: date,
    amount,
    platform,
  });

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (users.length) {
    const message =
      status === "Approved"
        ? "Received product request approved"
        : note || "Please approved my request";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: "/purchase-requisition",
        }),
      ),
    );
  }

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

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await Meta.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
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
  const { note, status, amount, userId } = payload;

  const data = {
    note: status === "Approved" ? "---" : note,
    status: status ? status : "Pending",
    amount,
  };

  const [updatedCount] = await Meta.update(data, {
    where: {
      Id: id,
    },
  });

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId }, // sender বাদ
      role: { [Op.in]: ["superAdmin", "admin", "marketer"] }, // তোমার DB অনুযায়ী ঠিক করো
    },
  });

  console.log("users", users.length);
  if (!users.length) return updatedCount;

  const message =
    finalStatus === "Approved"
      ? "Digital Expense request approved"
      : finalNote || "Digital Expense updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `http://localhost:5173/`,
      }),
    ),
  );

  return updatedCount;
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
