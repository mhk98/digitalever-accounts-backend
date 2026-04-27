const DailyWorkReportFilterableFields = [
  "searchTerm",
  "reportDate",
  "status",
  "userId",
  "employeeId",
  "departmentId",
  "startDate",
  "endDate",
];

const DailyWorkReportSearchableFields = [
  "todayWork",
  "tomorrowPlan",
  "blockers",
];

module.exports = {
  DailyWorkReportFilterableFields,
  DailyWorkReportSearchableFields,
};
