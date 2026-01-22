const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const ReceiveableService = require("./receiveable.service");
const { ReceiveableFilterAbleFields } = require("./receiveable.constants");

const insertIntoDB = catchAsync(async (req, res) => {
  const { name, amount, remarks, note, status } = req.body;
  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  const data = {
    name,
    amount,
    remarks,
    note,
    status,
    file,
  };

  console.log("Receiveable", data);
  const result = await ReceiveableService.insertIntoDB(data);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Receiveable data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, ReceiveableFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await ReceiveableService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Receiveable data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await ReceiveableService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Receiveable data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { name, amount, remarks, note, status } = req.body;

  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  const data = {
    name,
    amount,
    remarks,
    note,
    status,
    file,
  };
  const result = await ReceiveableService.updateOneFromDB(id, data);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Receiveable Receiveable update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await ReceiveableService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Receiveable delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await ReceiveableService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Receiveable data fetch!!",
    data: result,
  });
});

const ReceiveableController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = ReceiveableController;
