const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const AttendanceLog = db.attendanceLog;
const AttendanceEnrollment = db.attendanceEnrollment;
const AttendanceSummary = db.attendanceSummary;
const AttendanceDevice = db.attendanceDevice;
const EmployeeList = db.employeeList;
const Shift = db.shift;
const Holiday = db.holiday;

const logIncludes = [
  {
    model: AttendanceDevice,
    as: "device",
    attributes: ["Id", "name", "code", "model", "branch"],
    required: false,
  },
  {
    model: EmployeeList,
    as: "employee",
    attributes: ["Id", "name", "employee_id", "employeeCode", "status", "shiftId"],
    required: false,
  },
];

const normalizeOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const parseTimeToDate = (dateString, timeString) => {
  if (!timeString) return null;
  const base = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const [hours = "0", minutes = "0"] = String(timeString).split(":");
  base.setHours(Number(hours), Number(minutes), 0, 0);
  return base;
};

const minutesDiff = (later, earlier) => {
  if (!later || !earlier) return 0;
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / 60000));
};

const resolveEmployeeId = async ({ employeeId, deviceUserId, attendanceDeviceId }) => {
  const normalizedEmployeeId = normalizeOptionalNumber(employeeId);
  if (normalizedEmployeeId) return normalizedEmployeeId;

  if (!deviceUserId) return null;

  const enrollmentWhere = {
    deviceUserId: String(deviceUserId).trim(),
  };

  if (attendanceDeviceId) {
    enrollmentWhere.attendanceDeviceId = normalizeOptionalNumber(attendanceDeviceId);
  }

  const enrollment = await AttendanceEnrollment.findOne({
    where: enrollmentWhere,
    attributes: ["employeeId"],
    order: [["createdAt", "DESC"]],
  });

  return enrollment?.employeeId || null;
};

const sanitizeLogPayload = async (payload = {}) => {
  const attendanceDeviceId = normalizeOptionalNumber(payload.attendanceDeviceId);
  const deviceUserId = String(payload.deviceUserId || "").trim();

  if (!deviceUserId || !payload.punchTime) {
    throw new ApiError(400, "deviceUserId and punchTime are required");
  }

  const resolvedEmployeeId = await resolveEmployeeId({
    employeeId: payload.employeeId,
    deviceUserId,
    attendanceDeviceId,
  });

  return {
    attendanceDeviceId,
    employeeId: resolvedEmployeeId,
    deviceUserId,
    punchTime: payload.punchTime,
    punchType: payload.punchType || "check",
    verificationMethod: payload.verificationMethod || "face",
    syncBatchId: payload.syncBatchId || null,
    sourcePayload: payload.sourcePayload || null,
    processingStatus: payload.processingStatus || "Pending",
    processedAt: payload.processedAt || null,
    note: payload.note || null,
  };
};

const insertIntoDB = async (payload) => {
  const data = await sanitizeLogPayload(payload);
  const result = await AttendanceLog.create(data);

  if (data.attendanceDeviceId) {
    await AttendanceDevice.update(
      { lastSyncAt: new Date() },
      { where: { Id: data.attendanceDeviceId } },
    );
  }

  return AttendanceLog.findOne({
    where: { Id: result.Id },
    include: logIncludes,
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, from, to, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: [
        { deviceUserId: { [Op.like]: `%${searchTerm.trim()}%` } },
        { "$employee.name$": { [Op.like]: `%${searchTerm.trim()}%` } },
      ],
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    andConditions.push({ [key]: { [Op.eq]: value } });
  });

  if (from && to) {
    andConditions.push({
      punchTime: {
        [Op.between]: [startOfDay(from), endOfDay(to)],
      },
    });
  }

  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

  const data = await AttendanceLog.findAll({
    where: whereConditions,
    include: logIncludes,
    offset: skip,
    limit,
    paranoid: true,
    subQuery: false,
    order: [["punchTime", "DESC"]],
  });

  const count = await AttendanceLog.count({
    where: whereConditions,
    include: searchTerm ? logIncludes : [],
    distinct: true,
    col: "Id",
  });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () =>
  AttendanceLog.findAll({
    include: logIncludes,
    paranoid: true,
    order: [["punchTime", "DESC"]],
  });

const getDataById = async (id) =>
  AttendanceLog.findOne({
    where: { Id: id },
    include: logIncludes,
  });

const updateOneFromDB = async (id, payload) => {
  const data = await sanitizeLogPayload(payload);
  await AttendanceLog.update(data, { where: { Id: id } });
  return getDataById(id);
};

const deleteIdFromDB = async (id) =>
  AttendanceLog.destroy({
    where: { Id: id },
  });

const processDailyAttendance = async (date) => {
  if (!date) {
    throw new ApiError(400, "date is required in YYYY-MM-DD format");
  }

  const dateStart = startOfDay(date);
  const dateEnd = endOfDay(date);
  const weekday = dateStart.toLocaleDateString("en-US", { weekday: "long" });

  const [logs, employees, holidays] = await Promise.all([
    AttendanceLog.findAll({
      where: {
        punchTime: {
          [Op.between]: [dateStart, dateEnd],
        },
        deletedAt: { [Op.is]: null },
      },
      paranoid: true,
      order: [["punchTime", "ASC"]],
    }),
    EmployeeList.findAll({
      where: {
        deletedAt: { [Op.is]: null },
        status: {
          [Op.in]: ["Active", "Approved", "Pending"],
        },
      },
      include: [
        {
          model: Shift,
          as: "shift",
          attributes: ["Id", "name", "startTime", "endTime", "graceInMinutes", "graceOutMinutes", "weeklyOffDays"],
          required: false,
        },
      ],
      paranoid: true,
    }),
    Holiday.findAll({
      where: {
        holidayDate: date,
        deletedAt: { [Op.is]: null },
      },
      paranoid: true,
    }),
  ]);

  const isHoliday = holidays.length > 0;
  const logsByEmployeeId = logs.reduce((acc, log) => {
    if (!log.employeeId) return acc;
    if (!acc[log.employeeId]) acc[log.employeeId] = [];
    acc[log.employeeId].push(log);
    return acc;
  }, {});

  const processedSummaries = [];

  for (const employee of employees) {
    const employeeLogs = logsByEmployeeId[employee.Id] || [];
    const firstIn = employeeLogs[0]?.punchTime ? new Date(employeeLogs[0].punchTime) : null;
    const lastOut = employeeLogs.length
      ? new Date(employeeLogs[employeeLogs.length - 1].punchTime)
      : null;
    const workedMinutes = firstIn && lastOut ? minutesDiff(lastOut, firstIn) : 0;
    const shiftStart = parseTimeToDate(date, employee.shift?.startTime);
    const shiftEnd = parseTimeToDate(date, employee.shift?.endTime);
    const weeklyOffDays = Array.isArray(employee.shift?.weeklyOffDays)
      ? employee.shift.weeklyOffDays.map((item) => String(item).toLowerCase())
      : [];
    const isWeeklyOff = weeklyOffDays.includes(weekday.toLowerCase());

    let attendanceStatus = "Absent";
    if (isHoliday) attendanceStatus = employeeLogs.length ? "Holiday Worked" : "Holiday";
    else if (isWeeklyOff) attendanceStatus = employeeLogs.length ? "Weekly Off Worked" : "Weekly Off";
    else if (employeeLogs.length) attendanceStatus = "Present";

    const lateThreshold = shiftStart
      ? new Date(shiftStart.getTime() + Number(employee.shift?.graceInMinutes || 0) * 60000)
      : null;
    const earlyThreshold = shiftEnd
      ? new Date(shiftEnd.getTime() - Number(employee.shift?.graceOutMinutes || 0) * 60000)
      : null;

    const lateMinutes = firstIn && lateThreshold ? minutesDiff(firstIn, lateThreshold) : 0;
    const earlyLeaveMinutes = lastOut && earlyThreshold ? minutesDiff(earlyThreshold, lastOut) : 0;
    const overtimeMinutes = lastOut && shiftEnd ? minutesDiff(lastOut, shiftEnd) : 0;

    const remarks = [
      isHoliday ? holidays.map((holiday) => holiday.name).join(", ") : null,
      isWeeklyOff ? "Weekly off" : null,
      employeeLogs.length ? null : "No machine log captured",
    ]
      .filter(Boolean)
      .join(" | ") || null;

    const payload = {
      employeeId: employee.Id,
      attendanceDate: date,
      shiftId: employee.shiftId || employee.shift?.Id || null,
      firstIn,
      lastOut,
      workedMinutes,
      overtimeMinutes,
      lateMinutes,
      earlyLeaveMinutes,
      rawLogCount: employeeLogs.length,
      attendanceStatus,
      remarks,
      source: "machine",
    };

    const existing = await AttendanceSummary.findOne({
      where: {
        employeeId: employee.Id,
        attendanceDate: date,
      },
      attributes: ["Id"],
    });

    if (existing) {
      await AttendanceSummary.update(payload, { where: { Id: existing.Id } });
      processedSummaries.push(await AttendanceSummary.findOne({
        where: { Id: existing.Id },
      }));
    } else {
      processedSummaries.push(await AttendanceSummary.create(payload));
    }
  }

  await AttendanceLog.update(
    {
      processingStatus: "Processed",
      processedAt: new Date(),
    },
    {
      where: {
        punchTime: {
          [Op.between]: [dateStart, dateEnd],
        },
      },
    },
  );

  return {
    date,
    processedEmployees: processedSummaries.length,
  };
};

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  processDailyAttendance,
};
