const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const { DesignationSearchableFields } = require("./designation.constants");

const Designation = db.designation;
const Department = db.department;

const designationInclude = [
  {
    model: Department,
    as: "department",
    attributes: ["Id", "name", "code", "status"],
    required: false,
  },
];

const insertIntoDB = async (data) => {
  const result = await Designation.create(data);
  return Designation.findOne({
    where: { Id: result.Id },
    include: designationInclude,
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;
  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: DesignationSearchableFields.map((field) => ({
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

  const data = await Designation.findAll({
    where: whereConditions,
    include: designationInclude,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  const count = await Designation.count({ where: whereConditions });

  return {
    meta: { count, page, limit },
    data,
  };
};

const getAllFromDBWithoutQuery = async () => {
  return Designation.findAll({
    include: designationInclude,
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });
};

const getDataById = async (id) => {
  return Designation.findOne({
    where: { Id: id },
    include: designationInclude,
  });
};

const updateOneFromDB = async (id, payload) => {
  await Designation.update(payload, {
    where: { Id: id },
  });

  return getDataById(id);
};

const deleteIdFromDB = async (id) => {
  return Designation.destroy({
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
