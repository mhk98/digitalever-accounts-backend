const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const {
  DailyWorkReportSearchableFields,
} = require("./dailyWorkReport.constants");

const DailyWorkReport = db.dailyWorkReport;
const DailyWorkReportTask = db.dailyWorkReportTask;
const PerformanceEvaluation = db.performanceEvaluation;
const PerformanceScore = db.performanceScore;
const User = db.user;
const EmployeeList = db.employeeList;
const Department = db.department;
const Designation = db.designation;
const Notification = db.notification;
const Task = db.task;

const PRIVILEGED_ROLES = new Set(["superAdmin", "admin"]);
const VALID_PRIORITIES = new Set(["High", "Medium", "Low"]);
const VALID_TASK_STATUSES = new Set([
  "Completed",
  "Partial",
  "Pending",
  "Failed",
  "Hold",
]);
const VALID_TASK_SOURCES = new Set(["Assigned", "Self-created", "Urgent"]);
const VALID_REVIEW_STATUSES = new Set(["Pending", "Approved", "Rejected"]);

const STATUS_POINTS = {
  Completed: 10,
  Partial: 6,
  Pending: 5,
  Hold: 3,
  Failed: 0,
};

const PRIORITY_MULTIPLIER = {
  High: 1.3,
  Medium: 1,
  Low: 0.7,
};

const roundScore = (value) => Number(Number(value || 0).toFixed(2));

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
    attributes: [
      "Id",
      "name",
      "employeeCode",
      "employee_id",
      "departmentId",
      "designationId",
    ],
    required: false,
    include: [
      {
        model: Department,
        as: "department",
        attributes: ["Id", "name", "code"],
        required: false,
      },
      {
        model: Designation,
        as: "designation",
        attributes: ["Id", "name", "code"],
        required: false,
      },
    ],
  },
  {
    model: DailyWorkReportTask,
    as: "tasks",
    required: false,
    include: [
      {
        model: Task,
        as: "linkedTask",
        attributes: ["Id", "title", "priority", "status", "dueDate"],
        required: false,
      },
    ],
    separate: true,
    order: [["Id", "ASC"]],
  },
  {
    model: PerformanceEvaluation,
    as: "evaluation",
    required: false,
    include: [
      {
        model: User,
        as: "reviewedBy",
        attributes: ["Id", "FirstName", "LastName", "Email", "role"],
        required: false,
      },
    ],
  },
  {
    model: PerformanceScore,
    as: "performanceScore",
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

const validateScore = (value, fieldName, min, max) => {
  const score = Number(value);
  if (!Number.isFinite(score) || score < min || score > max) {
    throw new ApiError(400, `${fieldName} must be between ${min} and ${max}`);
  }
  return score;
};

const normalizeTime = (value, fieldName, { required = false } = {}) => {
  const normalized = String(value || "").trim();
  if (required && !normalized) throw new ApiError(400, `${fieldName} is required`);
  if (!normalized) return null;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    throw new ApiError(400, `${fieldName} must be HH:mm format`);
  }
  return normalized.length === 5 ? `${normalized}:00` : normalized;
};

const timeToMinutes = (value) => {
  if (!value) return null;
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
};

const calculateHours = (startTime, endTime, fallbackHours) => {
  const explicitHours = Number(fallbackHours);
  if (Number.isFinite(explicitHours) && explicitHours > 0) {
    return roundScore(explicitHours);
  }

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null) return 0;
  if (end < start) {
    throw new ApiError(400, "Work end time cannot be earlier than start time");
  }
  return roundScore((end - start) / 60);
};

const normalizeTask = (task = {}, index = 0) => {
  const priority = task.priority || "Medium";
  const status = task.status || "";
  const taskSource = task.taskId ? "Assigned" : task.taskSource || "Self-created";
  const selfRating = Number(task.selfRating);
  const progressPercent = Number(task.progressPercent ?? (status === "Completed" ? 100 : 0));
  const timeSpentMinutes = Number(task.timeSpentMinutes || 0);
  const startTime = normalizeTime(task.startTime, `tasks[${index}].startTime`);
  const endTime = normalizeTime(task.endTime, `tasks[${index}].endTime`);

  if (!VALID_PRIORITIES.has(priority)) {
    throw new ApiError(400, `tasks[${index}].priority is invalid`);
  }
  if (!VALID_TASK_STATUSES.has(status)) {
    throw new ApiError(400, `tasks[${index}].status is required`);
  }
  if (!VALID_TASK_SOURCES.has(taskSource)) {
    throw new ApiError(400, `tasks[${index}].taskSource is invalid`);
  }
  if (!Number.isFinite(selfRating) || selfRating < 1 || selfRating > 5) {
    throw new ApiError(400, `tasks[${index}].selfRating must be between 1 and 5`);
  }
  if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
    throw new ApiError(400, `tasks[${index}].progressPercent must be between 0 and 100`);
  }
  if (!Number.isFinite(timeSpentMinutes) || timeSpentMinutes < 0) {
    throw new ApiError(400, `tasks[${index}].timeSpentMinutes must be positive`);
  }
  if (startTime && endTime && timeToMinutes(endTime) < timeToMinutes(startTime)) {
    throw new ApiError(400, `tasks[${index}].endTime cannot be earlier than startTime`);
  }

  return {
    taskId: task.taskId ? Number(task.taskId) : null,
    taskSource,
    taskTitle: normalizeText(task.taskTitle || task.title, `tasks[${index}].taskTitle`, {
      required: true,
    }),
    taskDescription: normalizeText(task.taskDescription || task.description, "taskDescription"),
    taskCategory: normalizeText(task.taskCategory || task.category, "taskCategory"),
    priority,
    status,
    startTime,
    endTime,
    outputResult: normalizeText(task.outputResult || task.output, "outputResult"),
    proofLink: normalizeText(task.proofLink, "proofLink"),
    proofFileUrl: normalizeText(task.proofFileUrl, "proofFileUrl"),
    blockerProblem: normalizeText(task.blockerProblem || task.blocker, "blockerProblem"),
    selfRating: Math.round(selfRating),
    progressPercent: roundScore(progressPercent),
    timeSpentMinutes: Math.round(timeSpentMinutes),
    dueDate: task.dueDate || null,
    isDueToday: Boolean(task.isDueToday),
  };
};

const buildPayload = (payload = {}, fallbackDate) => {
  const tasks = Array.isArray(payload.tasks) ? payload.tasks.map(normalizeTask) : [];
  const reportDate = String(payload.reportDate || fallbackDate || "").slice(0, 10);
  const workStartTime = normalizeTime(payload.workStartTime, "workStartTime");
  const workEndTime = normalizeTime(payload.workEndTime, "workEndTime");

  if (!tasks.length && !payload.todayWork) {
    throw new ApiError(400, "At least one task is required");
  }

  return {
    report: {
      reportDate,
      todayWork:
        normalizeText(payload.todayWork, "todayWork") ||
        tasks.map((task) => `${task.taskTitle}: ${task.outputResult || task.status}`).join("\n"),
      tomorrowPlan: normalizeText(payload.tomorrowPlan, "tomorrowPlan") || "Not provided",
      blockers:
        normalizeText(payload.blockers, "blockers") ||
        tasks
          .map((task) => task.blockerProblem)
          .filter(Boolean)
          .join("\n") ||
        null,
      workStartTime,
      workEndTime,
      totalWorkingHours: calculateHours(
        workStartTime,
        workEndTime,
        payload.totalWorkingHours,
      ),
    },
    tasks,
  };
};

const getEmployeeProfile = async (userId) => {
  return EmployeeList.findOne({
    where: { userId },
    include: [
      { model: Department, as: "department", attributes: ["Id", "name", "code"], required: false },
      { model: Designation, as: "designation", attributes: ["Id", "name", "code"], required: false },
    ],
  });
};

const getDataById = async (id, actor) => {
  const where = { Id: id };

  if (!PRIVILEGED_ROLES.has(actor.role)) {
    where.userId = actor.Id;
  }

  const result = await DailyWorkReport.findOne({ where, include: reportIncludes });
  if (!result) throw new ApiError(404, "Daily work report not found");
  return result;
};

const calculateConsistencyScore = async (userId, reportDate, transaction) => {
  const end = new Date(`${reportDate}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);

  const startDate = start.toISOString().slice(0, 10);
  const submittedCount = await DailyWorkReport.count({
    where: {
      userId,
      reportDate: { [Op.between]: [startDate, reportDate] },
    },
    transaction,
  });

  return roundScore(Math.min(100, (submittedCount / 22) * 100));
};

const calculateScorePayload = async (report, tasks, evaluation, transaction) => {
  const totalTasks = tasks.length;
  const weightedTotal = tasks.reduce((sum, task) => {
    const dueMultiplier = task.isDueToday ? 1.1 : 1;
    return sum + 10 * PRIORITY_MULTIPLIER[task.priority] * dueMultiplier;
  }, 0);
  const earnedTotal = tasks.reduce((sum, task) => {
    const progressFactor =
      task.status === "Completed"
        ? 1
        : Math.max(0.1, Number(task.progressPercent || 0) / 100);
    const dueMultiplier = task.isDueToday ? 1.1 : 1;
    return (
      sum +
      STATUS_POINTS[task.status] *
        PRIORITY_MULTIPLIER[task.priority] *
        progressFactor *
        dueMultiplier
    );
  }, 0);
  const completedTasks = tasks.filter((task) => task.status === "Completed").length;
  const pendingTasks = tasks.filter((task) =>
    ["Pending", "Partial"].includes(task.status),
  ).length;
  const failedTasks = tasks.filter((task) => task.status === "Failed").length;
  const holdTasks = tasks.filter((task) => task.status === "Hold").length;
  const totalWorkingHours = Number(report.totalWorkingHours || 0);
  const taskCompletionScore = weightedTotal ? (earnedTotal / weightedTotal) * 100 : 0;
  const productivityScore = totalWorkingHours
    ? Math.min(100, ((completedTasks / totalWorkingHours) / 1.5) * 100)
    : completedTasks
      ? 100
      : 0;
  const qualityScore = Number(evaluation?.qualityScore || 0) * 10;
  const initiativeScore = Number(evaluation?.initiativeScore || 0) * 10;
  const consistencyScore = await calculateConsistencyScore(
    report.userId,
    report.reportDate,
    transaction,
  );
  const finalScore =
    taskCompletionScore * 0.4 +
    productivityScore * 0.2 +
    qualityScore * 0.2 +
    consistencyScore * 0.1 +
    initiativeScore * 0.1;

  return {
    reportId: report.Id,
    userId: report.userId,
    employeeId: report.employeeId,
    reportDate: report.reportDate,
    taskCompletionScore: roundScore(taskCompletionScore),
    productivityScore: roundScore(productivityScore),
    qualityScore: roundScore(qualityScore),
    consistencyScore,
    initiativeScore: roundScore(initiativeScore),
    finalScore: roundScore(finalScore),
    completedTasks,
    pendingTasks,
    failedTasks,
    holdTasks,
    totalTasks,
    totalWorkingHours: roundScore(totalWorkingHours),
  };
};

const normalizeTaskPriority = (priority) => {
  if (priority === "Urgent") return "High";
  if (priority === "Normal") return "Medium";
  return VALID_PRIORITIES.has(priority) ? priority : "Medium";
};

const normalizeTaskStatusForReport = (status) => {
  if (status === "Completed") return "Completed";
  if (status === "In Progress") return "Partial";
  if (status === "Cancelled") return "Hold";
  return "Pending";
};

const getAssignedTasksForReport = async (filters = {}, actor) => {
  const reportDate = String(filters.reportDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const userId = PRIVILEGED_ROLES.has(actor.role) && filters.userId ? Number(filters.userId) : actor.Id;
  const tasks = await Task.findAll({
    where: {
      assignedToUserId: userId,
      status: { [Op.notIn]: ["Completed", "Cancelled"] },
      [Op.or]: [
        { dueDate: { [Op.is]: null } },
        { dueDate: { [Op.lte]: reportDate } },
      ],
    },
    include: [
      {
        model: User,
        as: "assignedBy",
        attributes: ["Id", "FirstName", "LastName", "Email", "role"],
      },
    ],
    order: [
      ["dueDate", "ASC"],
      ["priority", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

  return tasks.map((task) => {
    const plain = task.get({ plain: true });
    return {
      taskId: plain.Id,
      taskSource: "Assigned",
      taskTitle: plain.title,
      taskDescription: plain.description || "",
      taskCategory: "Assigned Task",
      priority: normalizeTaskPriority(plain.priority),
      status: normalizeTaskStatusForReport(plain.status),
      dueDate: plain.dueDate,
      isDueToday: plain.dueDate === reportDate,
      progressPercent: plain.status === "In Progress" ? 50 : 0,
      timeSpentMinutes: 0,
      outputResult: "",
      blockerProblem: "",
      proofLink: "",
      proofFileUrl: "",
      selfRating: 3,
      assignedBy: plain.assignedBy,
    };
  });
};

const recalculatePerformanceScore = async (reportId, transaction) => {
  const report = await DailyWorkReport.findOne({ where: { Id: reportId }, transaction });
  if (!report) throw new ApiError(404, "Daily work report not found");

  const [tasks, evaluation] = await Promise.all([
    DailyWorkReportTask.findAll({ where: { reportId }, transaction }),
    PerformanceEvaluation.findOne({ where: { reportId }, transaction }),
  ]);

  const scorePayload = await calculateScorePayload(report, tasks, evaluation, transaction);
  const [score] = await PerformanceScore.findOrCreate({
    where: { reportId },
    defaults: scorePayload,
    transaction,
  });
  await score.update(scorePayload, { transaction });
  return score;
};

const submitReport = async (payload, actor) => {
  const today = new Date().toISOString().slice(0, 10);
  const data = buildPayload(payload, today);

  if (!data.report.reportDate) throw new ApiError(400, "reportDate is required");

  const existing = await DailyWorkReport.findOne({
    where: { userId: actor.Id, reportDate: data.report.reportDate },
  });
  if (existing) throw new ApiError(409, "You have already submitted today's work report");

  const employee = await getEmployeeProfile(actor.Id);

  const reportId = await db.sequelize.transaction(async (transaction) => {
    const report = await DailyWorkReport.create(
      {
        userId: actor.Id,
        employeeId: employee?.Id || null,
        ...data.report,
        submittedAt: new Date(),
        status: "Submitted",
      },
      { transaction },
    );

    await DailyWorkReportTask.bulkCreate(
      data.tasks.map((task) => ({ ...task, reportId: report.Id })),
      { transaction },
    );
    await PerformanceEvaluation.create(
      {
        reportId: report.Id,
        userId: report.userId,
        employeeId: report.employeeId,
        status: "Pending",
      },
      { transaction },
    );
    await recalculatePerformanceScore(report.Id, transaction);
    return report.Id;
  });

  return getDataById(reportId, actor);
};

const updateMyReport = async (id, payload, actor) => {
  const existing = await DailyWorkReport.findOne({ where: { Id: id, userId: actor.Id } });
  if (!existing) throw new ApiError(404, "Daily work report not found");
  if (existing.status === "Approved") {
    throw new ApiError(400, "Approved reports cannot be edited by employee");
  }

  const data = buildPayload(payload, existing.reportDate);

  await db.sequelize.transaction(async (transaction) => {
    await existing.update(
      {
        ...data.report,
        submittedAt: new Date(),
        status: "Submitted",
      },
      { transaction },
    );
    await DailyWorkReportTask.destroy({ where: { reportId: existing.Id }, transaction });
    await DailyWorkReportTask.bulkCreate(
      data.tasks.map((task) => ({ ...task, reportId: existing.Id })),
      { transaction },
    );
    await PerformanceEvaluation.update(
      { status: "Pending" },
      { where: { reportId: existing.Id }, transaction },
    );
    await recalculatePerformanceScore(existing.Id, transaction);
  });

  return getDataById(id, actor);
};

const deleteReport = async (id, actor) => {
  const where = { Id: id };
  if (!PRIVILEGED_ROLES.has(actor.role)) where.userId = actor.Id;
  const report = await DailyWorkReport.findOne({ where });
  if (!report) throw new ApiError(404, "Daily work report not found");
  await report.destroy();
  return report;
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
    departmentId,
  } = filters;
  const andConditions = [];

  if (!PRIVILEGED_ROLES.has(actor.role)) andConditions.push({ userId: actor.Id });
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
  if (reportDate) andConditions.push({ reportDate });
  if (startDate && endDate) andConditions.push({ reportDate: { [Op.between]: [startDate, endDate] } });
  if (status) andConditions.push({ status });
  if (userId) andConditions.push({ userId });
  if (employeeId) andConditions.push({ employeeId });
  if (departmentId) andConditions.push({ "$employee.departmentId$": departmentId });

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
      { model: User, as: "user", attributes: [], required: false },
      { model: EmployeeList, as: "employee", attributes: [], required: false },
    ],
    distinct: true,
    col: "Id",
  });

  return { meta: { count, page, limit }, data: result };
};

const reviewReport = async (id, payload, actor) => {
  const existing = await DailyWorkReport.findOne({ where: { Id: id } });
  if (!existing) throw new ApiError(404, "Daily work report not found");

  const qualityScore = validateScore(payload?.qualityScore, "qualityScore", 1, 10);
  const initiativeScore = validateScore(
    payload?.initiativeScore,
    "initiativeScore",
    1,
    10,
  );
  const reviewStatus = VALID_REVIEW_STATUSES.has(payload?.status)
    ? payload.status
    : "Approved";

  await db.sequelize.transaction(async (transaction) => {
    const [evaluation] = await PerformanceEvaluation.findOrCreate({
      where: { reportId: existing.Id },
      defaults: {
        reportId: existing.Id,
        employeeId: existing.employeeId,
        userId: existing.userId,
      },
      transaction,
    });
    await evaluation.update(
      {
        qualityScore,
        initiativeScore,
        managerRemarks: normalizeText(payload?.managerRemarks || payload?.reviewNote, "managerRemarks"),
        status: reviewStatus,
        reviewedByUserId: actor.Id,
        reviewedAt: new Date(),
      },
      { transaction },
    );
    await existing.update(
      {
        status: reviewStatus,
        reviewNote: normalizeText(payload?.managerRemarks || payload?.reviewNote, "reviewNote"),
        reviewedByUserId: actor.Id,
      },
      { transaction },
    );
    await recalculatePerformanceScore(existing.Id, transaction);
  });

  return getDataById(id, actor);
};

const getDateRange = (period, dateString) => {
  const base = new Date(`${dateString || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const start = new Date(base);
  const end = new Date(base);

  if (period === "weekly") {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    end.setDate(start.getDate() + 6);
  } else if (period === "monthly") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

const getLeaderboard = async (filters = {}, actor) => {
  const period = filters.period || "daily";
  const { startDate, endDate } = getDateRange(period, filters.date);
  const scores = await PerformanceScore.findAll({
    where: { reportDate: { [Op.between]: [startDate, endDate] } },
    include: [
      {
        model: EmployeeList,
        as: "employee",
        attributes: ["Id", "name", "employeeCode", "departmentId"],
        required: false,
        include: [
          { model: Department, as: "department", attributes: ["Id", "name"], required: false },
        ],
      },
      { model: User, as: "user", attributes: ["Id", "FirstName", "LastName", "Email"], required: false },
    ],
  });

  if (!PRIVILEGED_ROLES.has(actor.role)) {
    return scores.filter((row) => row.userId === actor.Id);
  }

  const grouped = scores.reduce((acc, row) => {
    const plain = row.get({ plain: true });
    const key = plain.employeeId || plain.userId;
    const current = acc[key] || {
      employeeId: plain.employeeId,
      userId: plain.userId,
      employeeName:
        plain.employee?.name ||
        `${plain.user?.FirstName || ""} ${plain.user?.LastName || ""}`.trim() ||
        plain.user?.Email ||
        "Unknown",
      department: plain.employee?.department?.name || "-",
      totalScore: 0,
      completedTasks: 0,
      pendingTasks: 0,
      failedTasks: 0,
      totalReportsSubmitted: 0,
    };
    current.totalScore += Number(plain.finalScore || 0);
    current.completedTasks += Number(plain.completedTasks || 0);
    current.pendingTasks += Number(plain.pendingTasks || 0);
    current.failedTasks += Number(plain.failedTasks || 0);
    current.totalReportsSubmitted += 1;
    acc[key] = current;
    return acc;
  }, {});

  return Object.values(grouped)
    .map((row) => ({
      ...row,
      totalScore: roundScore(row.totalScore / row.totalReportsSubmitted),
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((row, index) => ({ ...row, rank: index + 1 }));
};

const getEmployeeDashboard = async (actor) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const reportsRes = await getMyReports(
    actor,
    { startDate: monthStart, endDate: today },
    { page: 1, limit: 60 },
  );
  const todayReport = reportsRes.data.find((row) => row.reportDate === today) || null;
  const scores = reportsRes.data.map((row) => row.performanceScore).filter(Boolean);
  const monthlyAverageScore = scores.length
    ? roundScore(scores.reduce((sum, row) => sum + Number(row.finalScore || 0), 0) / scores.length)
    : 0;

  return {
    todayReport,
    previousReports: reportsRes.data,
    personalPerformanceScore: todayReport?.performanceScore?.finalScore || 0,
    weeklyScoreTrend: reportsRes.data.slice(0, 7).reverse().map((row) => ({
      date: row.reportDate,
      score: row.performanceScore?.finalScore || 0,
    })),
    monthlyAverageScore,
    managerFeedback: reportsRes.data
      .filter((row) => row.evaluation?.managerRemarks)
      .map((row) => ({
        reportDate: row.reportDate,
        remarks: row.evaluation.managerRemarks,
        status: row.evaluation.status,
      })),
  };
};

const getAdminDashboard = async (filters = {}, actor) => {
  if (!PRIVILEGED_ROLES.has(actor.role)) throw new ApiError(403, "Forbidden");
  const today = filters.date || new Date().toISOString().slice(0, 10);
  const leaderboard = await getLeaderboard({ period: "monthly", date: today }, actor);
  const todayReports = await DailyWorkReport.count({ where: { reportDate: today } });
  const pendingReviewReports = await DailyWorkReport.count({
    where: { reportDate: today, status: "Submitted" },
  });
  const activeEmployees = await User.count({ where: { role: "employee", status: "Active" } });
  const submittedRows = await DailyWorkReport.findAll({
    where: { reportDate: today },
    attributes: ["userId"],
    raw: true,
  });
  const submittedUserIds = submittedRows.map((row) => Number(row.userId));
  const notSubmittedToday = await User.count({
    where: {
      role: "employee",
      status: "Active",
      Id: submittedUserIds.length ? { [Op.notIn]: submittedUserIds } : { [Op.ne]: null },
    },
  });

  return {
    totalReportsToday: todayReports,
    pendingReviewReports,
    topPerformers: leaderboard.slice(0, 5),
    lowPerformers: leaderboard.slice(-5).reverse(),
    reportsNotSubmittedToday: notSubmittedToday,
    activeEmployees,
    departmentWisePerformance: leaderboard.reduce((acc, row) => {
      const key = row.department || "-";
      const current = acc[key] || { department: key, totalScore: 0, employees: 0 };
      current.totalScore += Number(row.totalScore || 0);
      current.employees += 1;
      acc[key] = current;
      return acc;
    }, {}),
    performanceChart: leaderboard.map((row) => ({
      employeeName: row.employeeName,
      score: row.totalScore,
    })),
  };
};

const sendPendingReminders = async (payload = {}) => {
  const targetDate = String(payload.reportDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
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
      Id: submittedUserIds.length ? { [Op.notIn]: submittedUserIds } : { [Op.ne]: null },
    },
    attributes: ["Id", "FirstName", "LastName", "Email"],
  });

  if (!employees.length) {
    return { reportDate: targetDate, reminderCount: 0, remindedUserIds: [] };
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

  return {
    reportDate: targetDate,
    reminderCount: notifications.length,
    remindedUserIds: employees.map((user) => user.Id),
  };
};

module.exports = {
  submitReport,
  updateMyReport,
  deleteReport,
  getMyReports,
  getAllReports,
  getDataById,
  reviewReport,
  recalculatePerformanceScore,
  getAssignedTasksForReport,
  getLeaderboard,
  getEmployeeDashboard,
  getAdminDashboard,
  sendPendingReminders,
};
