const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const db = require("../../../models");
const CashInOutService = require("./cashInOut.service");
const { CashInOutFilterAbleFields } = require("./cashInOut.constants");
const { Op } = require("sequelize");
const User = db.user;
const CashInOut = db.cashInOut;
const Notification = db.notification;

const insertIntoDB = catchAsync(async (req, res) => {
  const {
    name,
    paymentMode,
    paymentStatus,
    bankName,
    bankAccount,
    amount,
    remarks,
    category,
    date,
    note,
    status,
    bookId,
    supplierId,
    userId,
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  // ✅ Approved হলে পুরোনো date-ও allow + save
  const isApproved = String(status || "").trim() === "Approved";

  // ✅ current date না হলে auto Pending
  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : note
        ? "Pending"
        : "Active";

  const data = {
    name: name || null,
    paymentMode,
    paymentStatus,
    bankName: isBank ? bankName || "" : "", // ✅ Bank না হলে empty
    bankAccount: isBank ? bankAccountNumber : null, // ✅ Bank না হলে NULL (not "")
    amount: amountNumber,
    remarks: remarks || "",
    status: finalStatus || "---",
    note: note || null,
    date: date,
    file, // null allowed
    category,
    bookId,
    supplierId,
  };

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (users.length) {
    const message =
      status === "Approved"
        ? "Cash in/out request approved"
        : note || "Please approved my request";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: "/apikafela.digitalever.com.bd/purchase-requisition",
        }),
      ),
    );
  }

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
    date,
    note,
    category,
    status,
    bookId,
    supplierId,
    userId,
    actorRole,
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await CashInOut.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status"],
  });

  if (!existing) return 0;

  const oldNote = String(existing.note || "").trim();
  const newNote = String(note || "").trim();

  // ✅ newNote খালি না হলে + oldNote থেকে আলাদা হলে => pending trigger
  const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;

  // ✅ today না হলে pending trigger (date না পাঠালে trigger হবে না)
  const dateTriggersPending =
    Boolean(inputDateStr) && inputDateStr !== todayStr;

  const inputStatus = String(status || "").trim();

  let finalStatus = existing.status || "Pending";

  const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

  if (isPrivileged) {
    // ✅ superAdmin/admin: যা পাঠাবে সেটাই
    finalStatus = inputStatus || finalStatus;
  } else {
    // ✅ others: today date না হলে বা new note হলে Pending override
    if (dateTriggersPending || noteTriggersPending) {
      finalStatus = "Pending";
    } else {
      // ✅ otherwise: status পাঠালে সেটাই, না পাঠালে আগেরটা
      finalStatus = inputStatus || finalStatus;
    }
  }

  const data = {
    name: name ?? undefined,
    paymentMode: paymentMode ?? undefined,
    paymentStatus: paymentStatus ?? undefined,
    bankName: isBank ? bankName || "" : "", // ✅ Bank না হলে blank
    bankAccount: isBank ? bankAccountNumber : null, // ✅ Bank না হলে NULL
    remarks: remarks ?? undefined,
    note: newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
    category,
    bookId: bookId,
    supplierId: supplierId,
    ...(amountNumber !== undefined ? { amount: amountNumber } : {}),

    // ✅ file only include if uploaded
    ...(file !== undefined ? { file } : {}),
  };

  const result = await CashInOutService.updateOneFromDB(id, data);

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (users.length) {
    const message =
      status === "Approved"
        ? "Cash book request approved"
        : note || "Please approved my request";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/apikafela.digitalever.com.bd/book/${bookId}`,
        }),
      ),
    );
  }

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
