const EmployeeWorkReportFilterableFields = [
  "searchTerm",
  "reportDate",
  "userId",
  "employeeId",
  "startDate",
  "endDate",
];

const EmployeeWorkReportSearchableFields = ["name"];

const EmployeeWorkReportNumericFields = [
  "failedGiven",
  "failedReceived",
  "pendingGiven",
  "pendingReceived",
  "pendingReturnReceived",
  "canceledReceived",
  "holdReceived",
  "ideskGiven",
  "ideskReceived",
  "callDone",
  "callReceived",
  "whatsappDone",
  "whatsappReceived",
  "totalAssign",
  "totalOrder",
  "totalAmount",
];

module.exports = {
  EmployeeWorkReportFilterableFields,
  EmployeeWorkReportSearchableFields,
  EmployeeWorkReportNumericFields,
};
