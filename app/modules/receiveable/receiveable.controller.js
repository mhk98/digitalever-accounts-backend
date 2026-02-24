const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const ReceiveableService = require("./receiveable.service");
const { ReceiveableFilterAbleFields } = require("./receiveable.constants");
const db = require("../../../models");
const { Op } = require("sequelize");
const User = db.user;
const Receiveable = db.receiveable;

const insertIntoDB = catchAsync(async (req, res) => {
  const { name, amount, remarks, note, status, date, userId } = req.body;
  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

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
    name,
    amount,
    remarks,
    file,
    status: finalStatus || "---",
    note: note || null,
    date: date,
  };

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "accountant"] },
    },
  });

  if (users.length) {
    const message =
      status === "Approved"
        ? "Petty cash request approved"
        : note || "Please approved my request";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: "/purchase-requisition",
        }),
      ),
    );
  }

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
  const { name, amount, remarks, note, status, date, userId, actorRole } =
    req.body;

  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await Receiveable.findOne({
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
    amount,
    remarks,
    note: newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
    file,
  };

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "accountant"] },
    },
  });

  if (users.length) {
    const message =
      status === "Approved"
        ? "Petty cash request approved"
        : note || "Please approved my request";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: "/purchase-requisition",
        }),
      ),
    );
  }

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
