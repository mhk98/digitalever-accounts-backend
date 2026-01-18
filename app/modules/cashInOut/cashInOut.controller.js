const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const CashInOutService = require("./cashInOut.service");
const { CashInOutFilterAbleFields } = require("./cashInOut.constants");

const insertIntoDB = catchAsync(async (req, res) => {
  const {
    name,
    paymentMode,
    paymentStatus,
    bankName,
    bankAccount,
    amount,
    remarks,
    bookId,
  } = req.body;

  // ✅ file optional safe
  const file = req.file?.path ? req.file.path.replace(/\\/g, "/") : null;

  const isBank = paymentMode === "Bank";

  // ✅ bankAccount sanitize
  const bankAccountNumber =
    isBank &&
    bankAccount !== undefined &&
    bankAccount !== null &&
    String(bankAccount).trim() !== ""
      ? Number(bankAccount)
      : null;

  if (isBank && bankAccountNumber !== null && Number.isNaN(bankAccountNumber)) {
    throw new ApiError(400, "Bank Account must be a valid number");
  }

  // ✅ amount sanitize
  const amountNumber =
    amount !== undefined && amount !== null && String(amount).trim() !== ""
      ? Number(amount)
      : 0;

  if (!amountNumber || Number.isNaN(amountNumber) || amountNumber <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  const data = {
    name: name || null,
    paymentMode,
    paymentStatus,
    bankName: isBank ? bankName || "" : "", // ✅ Bank না হলে empty
    bankAccount: isBank ? bankAccountNumber : null, // ✅ Bank না হলে NULL (not "")
    amount: amountNumber,
    remarks: remarks || "",
    file, // null allowed
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

// const updateOneFromDB = catchAsync(async (req, res) => {
//   const { id } = req.params;
//   const {
//     name,
//     paymentMode,
//     paymentStatus,
//     bankName,
//     bankAccount,
//     amount,
//     remarks,
//     bookId,
//   } = req.body;
//   const file = req.file.path.replace(/\\/g, "/");

//   const data = {
//     name,
//     paymentMode,
//     bankName,
//     bankAccount,
//     paymentStatus,
//     amount,
//     remarks,
//     file,
//     bookId,
//   };

//   const result = await CashInOutService.updateOneFromDB(id, data);
//   sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "CashInOut CashInOut update successfully!!",
//     data: result,
//   });
// });

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;

  const {
    name,
    paymentMode,
    paymentStatus,
    bankName,
    bankAccount,
    amount,
    remarks,
    bookId,
  } = req.body;

  // ✅ file optional safe (new file না দিলে আগেরটা থাকবে - service এ handle করা ভাল)
  const file = req.file?.path ? req.file.path.replace(/\\/g, "/") : undefined;

  const isBank = paymentMode === "Bank";

  // ✅ bankAccount sanitize
  const bankAccountNumber =
    isBank &&
    bankAccount !== undefined &&
    bankAccount !== null &&
    String(bankAccount).trim() !== ""
      ? Number(bankAccount)
      : null;

  if (isBank && bankAccountNumber !== null && Number.isNaN(bankAccountNumber)) {
    throw new ApiError(400, "Bank Account must be a valid number");
  }

  // ✅ amount sanitize (update এ amount optional হতে পারে, তবে দিলে validate)
  const amountNumber =
    amount !== undefined && amount !== null && String(amount).trim() !== ""
      ? Number(amount)
      : undefined;

  if (
    amountNumber !== undefined &&
    (Number.isNaN(amountNumber) || amountNumber <= 0)
  ) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  const data = {
    name: name ?? undefined,
    paymentMode: paymentMode ?? undefined,
    paymentStatus: paymentStatus ?? undefined,
    bankName: isBank ? bankName || "" : "", // ✅ Bank না হলে blank
    bankAccount: isBank ? bankAccountNumber : null, // ✅ Bank না হলে NULL
    remarks: remarks ?? undefined,
    bookId: bookId ?? undefined,
    ...(amountNumber !== undefined ? { amount: amountNumber } : {}),

    // ✅ file only include if uploaded
    ...(file !== undefined ? { file } : {}),
  };

  const result = await CashInOutService.updateOneFromDB(id, data);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "CashInOut updated successfully!!",
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
