const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");

const CHARGE_MODELS = {
  cod: db.codCharge,
  delivery: db.deliveryCharge,
};

const normalizeChargeType = (chargeType) => {
  const value = String(chargeType || "").trim().toLowerCase();
  if (!CHARGE_MODELS[value]) {
    throw new ApiError(400, "Invalid charge type");
  }
  return value;
};

const getModelByType = (chargeType) => CHARGE_MODELS[normalizeChargeType(chargeType)];

const normalizeAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) {
    throw new ApiError(400, "Charge amount must be a positive number");
  }
  return value.toFixed(2);
};

const normalizeDate = (date) => {
  const value = String(date || "").trim();
  if (!value) {
    throw new ApiError(400, "Date is required");
  }
  return value;
};

const buildPayload = (payload, user) => ({
  date: normalizeDate(payload?.date),
  amount: normalizeAmount(payload?.amount),
  note: String(payload?.note || "").trim() || null,
  createdByUserId: user?.Id || user?.id || null,
  createdByRole: user?.role || null,
});

const createChargeSetting = async (payload, user) => {
  const Model = getModelByType(payload?.chargeType);
  return Model.create(buildPayload(payload, user));
};

const getChargeSettings = async (filters, options) => {
  const { chargeType, searchTerm } = filters || {};
  const Model = getModelByType(chargeType);
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const andConditions = [{ deletedAt: { [Op.is]: null } }];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({ note: { [Op.like]: `%${searchTerm.trim()}%` } });
  }

  const where = { [Op.and]: andConditions };
  const data = await Model.findAll({
    where,
    offset: skip,
    limit,
    order: [["date", "DESC"], ["createdAt", "DESC"]],
    paranoid: true,
  });
  const count = await Model.count({ where });

  return { meta: { count, page, limit }, data };
};

const updateChargeSetting = async (id, payload) => {
  const Model = getModelByType(payload?.chargeType);
  const existing = await Model.findOne({ where: { Id: id } });
  if (!existing) {
    throw new ApiError(404, "Charge not found");
  }

  const next = {};
  if (payload.date !== undefined) {
    next.date = normalizeDate(payload.date);
  }
  if (payload.amount !== undefined) {
    next.amount = normalizeAmount(payload.amount);
  }
  if (payload.note !== undefined) {
    next.note = String(payload.note || "").trim() || null;
  }

  await Model.update(next, { where: { Id: id } });
  return Model.findOne({ where: { Id: id } });
};

const deleteChargeSetting = async (id, chargeType) => {
  const Model = getModelByType(chargeType);
  const existing = await Model.findOne({ where: { Id: id } });
  if (!existing) {
    throw new ApiError(404, "Charge not found");
  }

  await Model.destroy({ where: { Id: id } });
  return { deleted: true };
};

module.exports = {
  createChargeSetting,
  getChargeSettings,
  updateChargeSetting,
  deleteChargeSetting,
};
