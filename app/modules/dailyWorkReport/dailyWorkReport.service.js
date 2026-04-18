const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const {
  DailyWorkReportSearchableFields,
} = require("./dailyWorkReport.constants");

const DailyWorkReport = db.dailyWorkReport;
const User = db.user;
const EmployeeList = db.employeeList;
const Notification = db.notification;

const PRIVILEGED_ROLES = new Set(["superAdmin", "admin", "accountant"]);

const reportIncludes = [
  {
    model: User,
    as: "user",
    attributes: ["Id", "FirstName", "LastName", "Email", "role"],
    required: false,
  },
  {
    model: EmployeeList,
    as: "employee",
    attributes: ["Id", "name", "employeeCode", "employee_id", "departmentId"],
    required: false,
  },
  {
    model: User,
    as: "reviewedBy",
    attributes: ["Id", "FirstName", "LastName", "Email", "role"],
    required: false,
  },
];

const normalizeText = (value, fieldName, { required = false } = {}) => {
  const normalized = String(value || "").trim();

  if (required && !normalized) {
    throw new ApiError(400, `${fieldName} is required`);
  }

  return normalized || null;
};

const buildPayload = (payload = {}, fallbackDate) => ({
  reportDate: String(payload.reportDate || fallbackDate || "").slice(0, 10),
  todayWork: normalizeText(payload.todayWork, "todayWork", { required: true }),
  tomorrowPlan: normalizeText(payload.tomorrowPlan, "tomorrowPlan", {
    required: true,
  }),
  blockers: normalizeText(payload.blockers, "blockers"),
});

const getEmployeeProfile = async (userId) => {
  return EmployeeList.findOne({
    where: { userId },
    attributes: ["Id", "name", "employeeCode", "employee_id"],
  });
};

const getDataById = async (id, actor) => {
  const where = { Id: id };

  if (!PRIVILEGED_ROLES.has(actor.role)) {
    where.userId = actor.Id;
  }

  const result = await DailyWorkReport.findOne({
    where,
    include: reportIncludes,
  });

  if (!result) {
    throw new ApiError(404, "Daily work report not found");
  }

  return result;
};

const submitReport = async (payload, actor) => {
  const today = new Date().toISOString().slice(0, 10);
  const data = buildPayload(payload, today);

  if (!data.reportDate) {
    throw new ApiError(400, "reportDate is required");
  }

  const existing = await DailyWorkReport.findOne({
    where: {
      userId: actor.Id,
      reportDate: data.reportDate,
    },
  });

  if (existing) {
    throw new ApiError(409, "You have already submitted today's work report");
  }

  const employee = await getEmployeeProfile(actor.Id);

  const result = await DailyWorkReport.create({
    userId: actor.Id,
    employeeId: employee?.Id || null,
    ...data,
    submittedAt: new Date(),
    status: "Submitted",
  });

  return DailyWorkReport.findOne({
    where: { Id: result.Id },
    include: reportIncludes,
  });
};

const updateMyReport = async (id, payload, actor) => {
  const existing = await DailyWorkReport.findOne({
    where: { Id: id, userId: actor.Id },
  });

  if (!existing) {
    throw new ApiError(404, "Daily work report not found");
  }

  const data = buildPayload(payload, existing.reportDate);

  await existing.update({
    ...data,
    submittedAt: new Date(),
    status: existing.status === "Reviewed" ? "Reviewed" : "Submitted",
  });

  return getDataById(id, actor);
};

const getMyReports = async (actor, filters, options) => {
  return getAllReports({ ...filters, userId: actor.Id }, options, actor);
};

const getAllReports = async (filters, options, actor) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const {
    searchTerm,
    startDate,
    endDate,
    reportDate,
    status,
    userId,
    employeeId,
  } = filters;

  const andConditions = [];

  if (!PRIVILEGED_ROLES.has(actor.role)) {
    andConditions.push({ userId: actor.Id });
  }

  if (searchTerm && searchTerm.trim()) {
    const normalizedSearchTerm = searchTerm.trim();
    andConditions.push({
      [Op.or]: [
        ...DailyWorkReportSearchableFields.map((field) => ({
          [field]: { [Op.like]: `%${normalizedSearchTerm}%` },
        })),
        { "$user.FirstName$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$user.LastName$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$user.Email$": { [Op.like]: `%${normalizedSearchTerm}%` } },
        { "$employee.name$": { [Op.like]: `%${normalizedSearchTerm}%` } },
      ],
    });
  }

  if (reportDate) {
    andConditions.push({ reportDate });
  }

  if (startDate && endDate) {
    andConditions.push({
      reportDate: { [Op.between]: [startDate, endDate] },
    });
  }

  if (status) {
    andConditions.push({ status });
  }

  if (userId) {
    andConditions.push({ userId });
  }

  if (employeeId) {
    andConditions.push({ employeeId });
  }

  const where = andConditions.length ? { [Op.and]: andConditions } : {};

  const result = await DailyWorkReport.findAll({
    where,
    offset: skip,
    limit,
    include: reportIncludes,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [
            ["reportDate", "DESC"],
            ["submittedAt", "DESC"],
          ],
  });

  const count = await DailyWorkReport.count({
    where,
    include: [
      {
        model: User,
        as: "user",
        attributes: [],
        required: false,
      },
      {
        model: EmployeeList,
        as: "employee",
        attributes: [],
        required: false,
      },
    ],
    distinct: true,
    col: "Id",
  });

  return {
    meta: { count, page, limit },
    data: result,
  };
};

const reviewReport = async (id, payload, actor) => {
  const existing = await DailyWorkReport.findOne({
    where: { Id: id },
  });

  if (!existing) {
    throw new ApiError(404, "Daily work report not found");
  }

  await existing.update({
    status: payload?.status === "Submitted" ? "Submitted" : "Reviewed",
    reviewNote: normalizeText(payload?.reviewNote, "reviewNote"),
    reviewedByUserId: actor.Id,
  });

  return getDataById(id, actor);
};

const sendPendingReminders = async (payload = {}) => {
  const targetDate =
    String(payload.reportDate || new Date().toISOString().slice(0, 10)).slice(
      0,
      10,
    );

  const submittedRows = await DailyWorkReport.findAll({
    where: { reportDate: targetDate },
    attributes: ["userId"],
    raw: true,
  });

  const submittedUserIds = submittedRows.map((row) => Number(row.userId));

  const employees = await User.findAll({
    where: {
      role: "employee",
      status: "Active",
      Id: submittedUserIds.length
        ? { [Op.notIn]: submittedUserIds }
        : { [Op.ne]: null },
    },
    attributes: ["Id", "FirstName", "LastName", "Email"],
  });

  if (!employees.length) {
    return {
      reportDate: targetDate,
      reminderCount: 0,
      remindedUserIds: [],
    };
  }

  const notifications = await Promise.all(
    employees.map((user) =>
      Notification.create({
        userId: String(user.Id),
        url: "/hrm/daily-work-reports",
        message: `Please submit your daily work report for ${targetDate} before leaving office.`,
      }),
    ),
  );

  await DailyWorkReport.update(
    { reminderSentAt: new Date() },
    {
      where: {
        reportDate: targetDate,
        userId: { [Op.in]: submittedUserIds },
      },
    },
  );

  return {
    reportDate: targetDate,
    reminderCount: notifications.length,
    remindedUserIds: employees.map((user) => user.Id),
  };
};

const DailyWorkReportService = {
  submitReport,
  updateMyReport,
  getMyReports,
  getAllReports,
  getDataById,
  reviewReport,
  sendPendingReminders,
};

module.exports = DailyWorkReportService;
