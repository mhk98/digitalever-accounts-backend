const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const CashInOutService = require("./cashInOut.service");
const { CashInOutFilterAbleFields } = require("./cashInOut.constants");

const insertIntoDB = catchAsync(async (req, res) => {
  const { name, paymentMode, paymentStatus, amount, remarks, bookId } =
    req.body;
  const file = req.file.path.replace(/\\/g, "/");

  const data = {
    name,
    paymentMode,
    paymentStatus,
    amount,
    remarks,
    file,
    bookId,
  };

  console.log("cashinout", data);
  const result = await CashInOutService.insertIntoDB(data);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, CashInOutFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await CashInOutService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await CashInOutService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await CashInOutService.updateOneFromDB(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut CashInOut update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await CashInOutService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await CashInOutService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut data fetch!!",
    data: result,
  });
});

const CashInOutController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = CashInOutController;
