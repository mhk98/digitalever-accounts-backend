const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { pettyCashSearchableFields } = require("./pettyCash.constants");
const PettyCash = db.pettyCash;
const Notification = db.notification;
const User = db.user;

const insertIntoDB = async (data) => {
  const result = await PettyCash.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  // if (searchTerm && searchTerm.trim()) {
  //   andConditions.push({
  //     [Op.or]: pettyCashSearchableFields.map((field) => ({
  //       [field]: { [Op.like]: `%${searchTerm.trim()}%` },
  //     })),
  //   });
  // }

  // if (searchTerm) {
  //   andConditions.push({
  //     [Op.or]: pettyCashSearchableFields.map((field) => ({
  //       [field]: { [Op.like]: `%${searchTerm}%` }, // Postgres হলে Op.iLike
  //     })),
  //   });
  // }

  if (searchTerm && String(searchTerm).trim()) {
    const term = String(searchTerm).trim();

    andConditions.push({
      [Op.or]: [
        { status: { [Op.like]: `%${term}%` } },
        { remarks: { [Op.like]: `%${term}%` } },
        { paymentMode: { [Op.like]: `%${term}%` } },
        { paymentStatus: { [Op.like]: `%${term}%` } },
        { category: { [Op.like]: `%${term}%` } },

        // ✅ numeric field search
        db.Sequelize.where(
          db.Sequelize.cast(db.Sequelize.col("amount"), "CHAR"),
          {
            [Op.like]: `%${term}%`,
          },
        ),
      ],
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
      date: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await PettyCash.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["date", "DESC"]],
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
  const { status, note, userId } = payload;
  const [updatedCount] = await PettyCash.update(payload, {
    where: {
      Id: id,
    },
  });

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId }, // sender বাদ
      role: { [Op.in]: ["superAdmin", "admin", "accountant"] }, // তোমার DB অনুযায়ী ঠিক করো
    },
  });

  console.log("users", users.length);
  if (!users.length) return updatedCount;

  const message =
    status === "Approved"
      ? "Petty cash request approved"
      : note || "Petty cash updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/kafelamart.digitalever.com.bd/petty-cash`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await PettyCash.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

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
