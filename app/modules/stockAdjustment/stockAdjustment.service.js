const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  StockAdjustmentSearchableFields,
} = require("./stockAdjustment.constants");
const StockAdjustment = db.stockAdjustment;
const Notification = db.notification;
const User = db.user;
const Item = db.item;
const ItemMaster = db.itemMaster;

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

const insertIntoDB = async (payload) => {
  const { itemId, unit, unitValue, date, note, status, stock } = payload;

  const itemData = await Item.findOne({ where: { Id: itemId } });
  if (!itemData) throw new ApiError(404, "Item not found");

  const totalUnitValue = toNumber(unitValue);

  if (totalUnitValue <= 0) {
    throw new ApiError(400, "unitValue must be greater than 0");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  const isApproved = String(status || "").trim() === "Approved";

  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : note
        ? "Pending"
        : "Active";

  return db.sequelize.transaction(async (t) => {
    const StockAdjustmentData = {
      itemId,
      name: itemData.name,
      unit: unit || "Pcs",
      unitValue: totalUnitValue,
      date,
      note: note || null,
      status: finalStatus,
    };

    const stockRow = await ItemMaster.findOne({
      where: { itemId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (stockRow) {
      const plusQuantity = toNumber(stockRow.unitValue) + totalUnitValue;
      const minusQuantity = toNumber(stockRow.unitValue) - totalUnitValue;
      await stockRow.update(
        {
          itemId,
          name: itemData.name,
          unitValue: stock === "In" ? plusQuantity : minusQuantity,
          unit: unit || stockRow.unit || "Pcs",
          stock,
        },
        { transaction: t },
      );
    }

    return StockAdjustment.create(StockAdjustmentData, { transaction: t });
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: StockAdjustmentSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  andConditions.push({ deletedAt: { [Op.is]: null } });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const [data, count] = await Promise.all([
    StockAdjustment.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    StockAdjustment.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data,
  };
};

const getDataById = async (id) => {
  return StockAdjustment.findAll({ where: { productId: id } });
};

const deleteIdFromDB = async (id) => {
  return StockAdjustment.destroy({ where: { Id: id } });
};

const updateOneFromDB = async (id, payload) => {
  const {
    itemId,
    productId,
    name,
    unit,
    unitValue,
    cost,
    note,
    date,
    status,
    userId,
    actorRole,
  } = payload;

  const existing = await StockAdjustment.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status"],
  });

  if (!existing) return 0;

  const oldNote = String(existing.note || "").trim();
  const newNote = String(note || "").trim();
  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);
  const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
  const dateTriggersPending =
    Boolean(inputDateStr) && inputDateStr !== todayStr;
  const inputStatus = String(status || "").trim();
  const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

  let finalStatus = existing.status || "Pending";
  if (isPrivileged) {
    finalStatus = inputStatus || finalStatus;
  } else if (dateTriggersPending || noteTriggersPending) {
    finalStatus = "Pending";
  } else {
    finalStatus = inputStatus || finalStatus;
  }

  const totalUnitValue =
    unitValue === "" || unitValue == null ? undefined : toNumber(unitValue);
  const totalCost = cost === "" || cost == null ? undefined : toNumber(cost);

  const data = {
    itemId: itemId || undefined,
    productId: productId || undefined,
    name: name === "" || name == null ? undefined : name,
    unit: unit === "" || unit == null ? undefined : unit,
    unitValue: totalUnitValue,
    cost: totalCost,
    unitCost:
      totalUnitValue && totalUnitValue > 0 && totalCost != null
        ? totalCost / totalUnitValue
        : undefined,
    note: newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
  };

  const [updatedCount] = await StockAdjustment.update(data, {
    where: { Id: id },
  });
  if (updatedCount <= 0) return updatedCount;

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (!users.length) return updatedCount;

  const message =
    finalStatus === "Approved"
      ? "StockAdjustment request approved"
      : newNote || "StockAdjustment updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: "/holygift.digitalever.com.bd/StockAdjustment",
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  return StockAdjustment.findAll();
};

const StockAdjustmentService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = StockAdjustmentService;
