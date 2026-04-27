const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { EmployeeListSearchableFields } = require("./employeeList.constants");
const {
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
  isPrivilegedRole,
} = require("../../../shared/approvalWorkflow");

const EmployeeList = db.employeeList;
const User = db.user;
const Department = db.department;
const Designation = db.designation;
const Shift = db.shift;

const normalizeOptionalForeignKey = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const employeeIncludes = [
  {
    model: User,
    as: "user",
    attributes: ["Id", "FirstName", "LastName", "Email", "Phone", "role"],
    required: false,
  },
  {
    model: Department,
    as: "department",
    attributes: ["Id", "name", "code", "status"],
    required: false,
  },
  {
    model: Designation,
    as: "designation",
    attributes: ["Id", "name", "code", "status"],
    required: false,
  },
  {
    model: Shift,
    as: "shift",
    attributes: ["Id", "name", "code", "startTime", "endTime", "status"],
    required: false,
  },
  {
    model: EmployeeList,
    as: "reportingManager",
    attributes: ["Id", "name", "employeeCode", "employee_id"],
    required: false,
  },
];

const buildEmployeeData = (payload = {}, currentStatus) => {
  const inputStatus = String(payload.status || "").trim();
  const inputDateStr = String(payload.date || payload.joiningDate || "").slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);
  const note = String(payload.note || "").trim();

  const finalStatus =
    inputStatus ||
    currentStatus ||
    (inputDateStr && inputDateStr !== todayStr ? "Pending" : note ? "Pending" : "Active");

  return {
    name: payload.name,
    employee_id: payload.employee_id,
    employeeCode: payload.employeeCode || null,
    userId: normalizeOptionalForeignKey(payload.userId),
    email: payload.email || null,
    phone: payload.phone || null,
    departmentId: normalizeOptionalForeignKey(payload.departmentId),
    designationId: normalizeOptionalForeignKey(payload.designationId),
    shiftId: normalizeOptionalForeignKey(payload.shiftId),
    reportingManagerId: normalizeOptionalForeignKey(payload.reportingManagerId),
    employmentType: payload.employmentType || null,
    joiningDate: payload.joiningDate || inputDateStr || null,
    salary: payload.salary,
    status: finalStatus,
    pendingAction: payload.pendingAction || null,
    approvalNote:
      payload.approvalNote !== undefined
        ? String(payload.approvalNote || "").trim() || null
        : null,
    requestedByUserId: payload.requestedByUserId || null,
    date: inputDateStr || null,
    note: finalStatus === "Approved" ? null : note || null,
  };
};

const ensureLinkedUserExists = async (userId) => {
  if (!userId) return;

  const user = await User.findOne({
    where: { Id: userId },
    attributes: ["Id"],
  });

  if (!user) {
    throw new ApiError(400, "Linked user was not found");
  }
};

const insertIntoDB = async (payload, user) => {
  const data = buildEmployeeData(applyCreateWorkflow(payload, user));

  await ensureLinkedUserExists(data.userId);

  return db.sequelize.transaction(async (t) => {
    const result = await EmployeeList.create(data, { transaction: t });

    return EmployeeList.findOne({
      where: { Id: result.Id },
      include: employeeIncludes,
      transaction: t,
    });
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    const normalizedSearchTerm = searchTerm.trim();
    andConditions.push({
      [Op.or]: EmployeeListSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${normalizedSearchTerm}%` },
      })),
    });
  }

  Object.entries(otherFilters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    andConditions.push({
      [key]: { [Op.eq]: value },
    });
  });

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

  const result = await EmployeeList.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: employeeIncludes,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await EmployeeList.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  return EmployeeList.findOne({
    where: { Id: id },
    include: employeeIncludes,
  });
};

const getProfileByUserId = async (userId) => {
  const result = await EmployeeList.findOne({
    where: { userId },
    include: employeeIncludes,
  });

  if (!result) {
    throw new ApiError(404, "Employee profile was not found for this user");
  }

  return result;
};

const deleteIdFromDB = async (id, user, note) => {
  const existing = await EmployeeList.findOne({
    where: { Id: id },
    attributes: ["Id"],
  });

  if (!existing) {
    throw new ApiError(404, "Employee record not found");
  }

  if (isPrivilegedRole(user.role)) {
    await EmployeeList.destroy({
      where: { Id: id },
    });

    return { deleted: true, workflowAction: "deleted" };
  }

  await EmployeeList.update(buildDeleteWorkflowPayload(note, user), {
    where: { Id: id },
  });

  return {
    ...(await getDataById(id))?.get({ plain: true }),
    workflowAction: "delete_requested",
  };
};

const updateOneFromDB = async (id, payload, user) => {
  const existing = await EmployeeList.findOne({
    where: { Id: id },
    attributes: ["Id", "status"],
  });

  if (!existing) {
    throw new ApiError(404, "Employee record not found");
  }

  const data = buildEmployeeData(
    applyUpdateWorkflow(payload, user),
    existing.status,
  );

  await ensureLinkedUserExists(data.userId);

  await EmployeeList.update(data, {
    where: { Id: id },
  });

  return getDataById(id);
};

const approveOneFromDB = async (id) => {
  const existing = await EmployeeList.findOne({
    where: { Id: id },
    attributes: ["Id", "pendingAction"],
  });

  if (!existing) {
    throw new ApiError(404, "Employee record not found");
  }

  if (existing.pendingAction === "Delete") {
    await EmployeeList.destroy({ where: { Id: id } });
    return { deleted: true, workflowAction: "deleted" };
  }

  await EmployeeList.update(
    {
      status: "Active",
      pendingAction: null,
      approvalNote: null,
      requestedByUserId: null,
    },
    { where: { Id: id } },
  );

  return {
    ...(await getDataById(id))?.get({ plain: true }),
    workflowAction: "approved",
  };
};

const getAllFromDBWithoutQuery = async () => {
  return EmployeeList.findAll({
    include: employeeIncludes,
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
};

const EmployeeListService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  approveOneFromDB,
  getDataById,
  getProfileByUserId,
  getAllFromDBWithoutQuery,
};

module.exports = EmployeeListService;
