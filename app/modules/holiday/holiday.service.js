const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const { HolidaySearchableFields } = require("./holiday.constants");

const Holiday = db.holiday;

const insertIntoDB = async (data) => {
  return Holiday.create(data);
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: HolidaySearchableFields.map((field) => ({
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

  const data = await Holiday.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["holidayDate", "DESC"]],
  });

  const count = await Holiday.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () => {
  return Holiday.findAll({
    paranoid: true,
    order: [["holidayDate", "DESC"]],
  });
};

const getDataById = async (id) => {
  return Holiday.findOne({
    where: { Id: id },
  });
};

const updateOneFromDB = async (id, payload) => {
  await Holiday.update(payload, {
    where: { Id: id },
  });

  return getDataById(id);
};

const deleteIdFromDB = async (id) => {
  return Holiday.destroy({
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
