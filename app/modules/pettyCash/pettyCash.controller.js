const catchAsync = require("../../../shared/catchAsync");
const sendResponse = require("../../../shared/sendResponse");
const pick = require("../../../shared/pick");
const db = require("../../../models");
const PettyCashService = require("./pettyCash.service");
const { pettyCashFilterAbleFields } = require("./pettyCash.constants");
const User = db.user;

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
    userId,
  } = req.body;
  // const file = req.file.path.replace(/\\/g, "/");
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
      : null;

  const data = {
    name,
    paymentMode,
    bankName,
    paymentStatus,
    amount,
    remarks,
    file,
    status: finalStatus || "---",
    note: note || "---",
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

  const result = await PettyCashService.insertIntoDB(data);

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
    status,
    remarks,
    userId,
  } = req.body;
  // const file = req.file.path.replace(/\\/g, "/");
  const file = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

  const data = {
    name,
    paymentMode,
    bankName,
    paymentStatus,
    amount,
    note: status === "Approved" ? "---" : note,
    status: status ? status : "Pending",
    remarks,
    file,
  };
  const result = await PettyCashService.updateOneFromDB(id, data);

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
        ? "Petty cash request approved"
        : note || "Please approved my request";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: "/petty-cash",
        }),
      ),
    );
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
