const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const { UserFilterAbleFileds } = require("./user.constants");
const UserService = require("./user.service");
// const { UserService } = require("./user.service");

const login = catchAsync(async (req, res) => {
  const result = await UserService.login(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User login successfully!!",
    data: result,
  });
});

const register = catchAsync(async (req, res) => {
  const {
    FirstName,
    LastName,
    Email,
    Password,
    Address,
    Phone,
    City,
    PostalCode,
    Country,
    role,
  } = req.body;

  const data = {
    FirstName,
    LastName,
    Email,
    Password,
    Address,
    Phone,
    City,
    PostalCode,
    Country,
    role,
    image: req.file === undefined ? undefined : req.file.path,
  };
  const result = await UserService.register(data);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User register successfully!!",
    data: result,
  });
});

const getAllUserFromDB = catchAsync(async (req, res) => {
  const filters = pick(req.query, UserFilterAbleFileds);

  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await UserService.getAllUserFromDB(filters, options);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User data fetched!!",
    meta: result.meta,
    data: result.data,
  });
});

const getUserById = catchAsync(async (req, res) => {
  const result = await UserService.getUserById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User data fetched!!",
    data: result,
  });
});

const updateUserFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  console.log("userId", id);
  const {
    FirstName,
    LastName,
    Email,
    Password,
    Address,
    Phone,
    City,
    PostalCode,
    Country,
    role,
  } = req.body;

  let newPassword;

  // ✅ শুধু তখনই hash করবে যদি newPassword থাকে
  if (Password && Password.trim() !== "") {
    const salt = await bcrypt.genSalt(10);
    newPassword = await bcrypt.hash(Password, salt);
  }

  console.log(req.body);
  const data = {
    FirstName,
    LastName,
    Email,
    Password: newPassword,
    Address,
    Phone,
    City,
    PostalCode,
    Country,
    role,
    image: req.file === undefined ? undefined : req.file.path,
  };

  // console.log('userData', data);

  console.log(id);
  const result = await UserService.updateUserFromDB(id, data);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User update successfully!!",
    data: result,
  });
});

const deleteUserFromDB = catchAsync(async (req, res) => {
  const result = await UserService.deleteIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User delete successfully!!",
    data: result,
  });
});

const UserController = {
  getAllUserFromDB,
  login,
  register,
  getUserById,
  updateUserFromDB,
  deleteUserFromDB,
};

module.exports = UserController;
