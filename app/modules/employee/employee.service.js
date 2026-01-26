const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { EmployeeSearchableFields } = require("./employee.constants");
const Employee = db.employee;
const Notification = db.notification;
const User = db.user;

const insertIntoDB = async (data) => {
  const result = await Employee.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: EmployeeSearchableFields.map((field) => ({
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

  const result = await Employee.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const total = await Employee.count({ where: whereConditions });

  return {
    meta: { total, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await Employee.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await Employee.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const {
    name,
    employee_id,
    basic_salary,
    incentive,
    holiday_payment,
    total_salary,
    advance,
    late,
    early_leave,
    absent,
    friday_absent,
    unapproval_absent,
    net_salary,
    note,
    remarks,
    status,
    userId,
  } = payload;

  const finalStatus = status || "Pending";
  const finalNote = finalStatus === "Approved" ? "-" : note;

  const data = {
    name,
    employee_id,
    basic_salary,
    incentive,
    holiday_payment,
    total_salary,
    advance,
    late,
    early_leave,
    absent,
    friday_absent,
    unapproval_absent,
    net_salary,
    note: finalNote,
    remarks,
    status: finalStatus,
  };

  const [updatedCount] = await Employee.update(data, {
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
    finalStatus === "Approved"
      ? "Employee salary calculation request approved"
      : finalNote || "Employee salary calculation updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `http://localhost:5173/employee`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Employee.findAll();

  return result;
};

const EmployeeService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = EmployeeService;
