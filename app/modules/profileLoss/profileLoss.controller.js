const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const { ProfileLossFilterAbleFileds } = require("./profileLoss.constants");
const ProfileLossService = require("./profileLoss.service");

const insertIntoDB = catchAsync(async (req, res) => {
  const result = await ProfileLossService.insertIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ProfileLoss data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, ProfileLossFilterAbleFileds);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await ProfileLossService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Academic Semster data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await ProfileLossService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ProfileLoss data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ProfileLossService.updateOneFromDB(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ProfileLoss update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await ProfileLossService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ProfileLoss delete successfully!!",
    data: result,
  });
});

// const removeIdFromDB = catchAsync(async (req, res) => {
//   const result = await ProfileLossService.deleteIdFromDB(req.params.id);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "ProfileLoss delete successfully!!",
//     data: result,
//   });
// });

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await ProfileLossService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "ProfileLoss data fetch!!",
    data: result,
  });
});

const ProfileLossController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = ProfileLossController;
