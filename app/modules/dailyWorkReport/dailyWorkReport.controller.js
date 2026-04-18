const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const {
  DailyWorkReportFilterableFields,
} = require("./dailyWorkReport.constants");
const DailyWorkReportService = require("./dailyWorkReport.service");

const submitReport = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.submitReport(req.body, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report submitted successfully!!",
    data: result,
  });
});

const updateMyReport = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.updateMyReport(
    req.params.id,
    req.body,
    req.user,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report updated successfully!!",
    data: result,
  });
});

const getMyReports = catchAsync(async (req, res) => {
  const filters = pick(req.query, DailyWorkReportFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await DailyWorkReportService.getMyReports(req.user, filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "My daily work reports fetched successfully!!",
    meta: result.meta,
    data: result.data,
  });
});

const getAllReports = catchAsync(async (req, res) => {
  const filters = pick(req.query, DailyWorkReportFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await DailyWorkReportService.getAllReports(filters, options, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work reports fetched successfully!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.getDataById(req.params.id, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report fetched successfully!!",
    data: result,
  });
});

const reviewReport = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.reviewReport(
    req.params.id,
    req.body,
    req.user,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report reviewed successfully!!",
    data: result,
  });
});

const sendPendingReminders = catchAsync(async (req, res) => {
  const result = await DailyWorkReportService.sendPendingReminders(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Daily work report reminders sent successfully!!",
    data: result,
  });
});

module.exports = {
  submitReport,
  updateMyReport,
  getMyReports,
  getAllReports,
  getDataById,
  reviewReport,
  sendPendingReminders,
};
