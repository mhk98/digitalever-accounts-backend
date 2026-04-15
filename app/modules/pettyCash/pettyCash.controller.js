const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const db = require("../../../models");
const PettyCashService = require("./pettyCash.service");
const { pettyCashFilterAbleFields } = require("./pettyCash.constants");
const { Op } = require("sequelize");
const User = db.user;
const Notification = db.notification;
const PettyCash = db.pettyCash;

const notifyPettyCashUsers = async ({ userId, roles, message, url }) => {
  if (!roles?.length || !message || !url) return;

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: roles },
    },
  });

  if (!users.length) return;

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url,
      }),
    ),
  );
};

const insertIntoDB = catchAsync(async (req, res) => {
  const {
    name,
    paymentMode,
    bankName,
    paymentStatus,
    amount,
    remarks,
    note,
    date,
    status,
    category,
    userId,
  } = req.body;
  // const file = req.file.path.replace(/\\/g, "/");
  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  const inputStatus = String(status || "").trim();
  const isApproved = inputStatus === "Approved";
  const isPending = inputStatus === "Pending";

  const finalStatus = isApproved
    ? "Approved"
    : isPending
      ? "Pending"
      : inputDateStr !== todayStr
        ? "Pending"
        : note
          ? "Pending"
          : "Active";

  const data = {
    name,
    paymentMode,
    bankName,
    paymentStatus,
    amount,
    remarks,
    file,
    status: finalStatus || "---",
    note: note || null,
    date: date,
    category,
  };

  const result = await PettyCashService.insertIntoDB(data);

  if (finalStatus === "Pending") {
    await notifyPettyCashUsers({
      userId,
      roles: ["superAdmin", "admin"],
      message: note || "Petty cash requisition request",
      url: `/kafelamart.digitalever.com.bd/petty-cash-requisition`,
    });
  } else if (finalStatus === "Approved") {
    await notifyPettyCashUsers({
      userId,
      roles: ["accountant"],
      message: "Petty cash requisition request approved",
      url: `/kafelamart.digitalever.com.bd/petty-cash`,
    });
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash data created!!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, pettyCashFilterAbleFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await PettyCashService.getAllFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getDataById = catchAsync(async (req, res) => {
  const result = await PettyCashService.getDataById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash data fetched!!",
    data: result,
  });
});

const updateOneFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    paymentMode,
    bankName,
    paymentStatus,
    amount,
    note,
    date,
    status,
    category,
    remarks,
    userId,
    actorRole,
  } = req.body;
  // const file = req.file.path.replace(/\\/g, "/");
  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await PettyCash.findOne({
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
    name,
    paymentMode,
    bankName,
    paymentStatus,
    amount,
    note: newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
    remarks,
    category,
    file,
  };
  const result = await PettyCashService.updateOneFromDB(id, data);

  if (finalStatus === "Pending") {
    await notifyPettyCashUsers({
      userId,
      roles: ["superAdmin", "admin"],
      message: newNote || "Petty cash requisition request",
      url: `/kafelamart.digitalever.com.bd/petty-cash-requisition`,
    });
  } else if (finalStatus === "Approved") {
    await notifyPettyCashUsers({
      userId,
      roles: ["accountant"],
      message: "Petty cash requisition request approved",
      url: `/kafelamart.digitalever.com.bd/petty-cash`,
    });
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash PettyCash update successfully!!",
    data: result,
  });
});

const deleteIdFromDB = catchAsync(async (req, res) => {
  const result = await PettyCashService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash delete successfully!!",
    data: result,
  });
});

const getAllFromDBWithoutQuery = catchAsync(async (req, res) => {
  const result = await PettyCashService.getAllFromDBWithoutQuery();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "PettyCash data fetch!!",
    data: result,
  });
});

const PettyCashController = {
  getAllFromDB,
  insertIntoDB,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
  getAllFromDBWithoutQuery,
};

module.exports = PettyCashController;
