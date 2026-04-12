const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const {
  AttendanceDeviceSearchableFields,
} = require("./attendanceDevice.constants");

const AttendanceDevice = db.attendanceDevice;

const insertIntoDB = async (data) => {
  return AttendanceDevice.create(data);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: AttendanceDeviceSearchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    andConditions.push({
      [key]: { [Op.eq]: value },
    });
  });

  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length ? { [Op.and]: andConditions } : {};

  const data = await AttendanceDevice.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await AttendanceDevice.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () => {
  return AttendanceDevice.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
};

const getDataById = async (id) => {
  return AttendanceDevice.findOne({
    where: { Id: id },
  });
};

const updateOneFromDB = async (id, payload) => {
  await AttendanceDevice.update(payload, {
    where: { Id: id },
  });

  return getDataById(id);
};

const deleteIdFromDB = async (id) => {
  return AttendanceDevice.destroy({
    where: { Id: id },
  });
};

module.exports = {
  insertIntoDB,
  getAllFromDB,
  getAllFromDBWithoutQuery,
  getDataById,
  updateOneFromDB,
  deleteIdFromDB,
};
