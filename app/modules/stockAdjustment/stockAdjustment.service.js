const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const {
  formatStockForDisplay,
  toBaseStockPayload,
  toNumber,
} = require("../../../helpers/unitConversionHelper");
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

const insertIntoDB = async (payload) => {
  const { itemId, unit, unitValue, date, note, status, stock, supplierId } =
    payload;

  const itemData = await Item.findOne({ where: { Id: itemId } });
  if (!itemData) throw new ApiError(404, "Item not found");

  const normalizedPayload = toBaseStockPayload(unit, unitValue);
  const totalUnitValue = normalizedPayload.unitValue;

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
      unit: normalizedPayload.unit,
      unitValue: totalUnitValue,
      date,
      supplierId,
      note: note || null,
      status: finalStatus,
    };

    const stockRow = await ItemMaster.findOne({
      where: { itemId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (stockRow) {
      const currentStockPayload = toBaseStockPayload(
        stockRow.unit,
        stockRow.unitValue,
      );
      const plusQuantity = currentStockPayload.unitValue + totalUnitValue;
      const minusQuantity = currentStockPayload.unitValue - totalUnitValue;

      if (stock === "Out" && minusQuantity < 0) {
        throw new ApiError(400, "Item stock cannot be negative");
      }

      await stockRow.update(
        {
          itemId,
          name: itemData.name,
          unitValue: stock === "In" ? plusQuantity : minusQuantity,
          unit: currentStockPayload.isWeightUnit
            ? "Gram"
            : normalizedPayload.unit,
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
    data: data.map(formatStockForDisplay),
  };
};

const getDataById = async (id) => {
  const data = await StockAdjustment.findAll({ where: { productId: id } });
  return data.map(formatStockForDisplay);
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
    supplierId,

    userId,
    actorRole,
  } = payload;

  const existing = await StockAdjustment.findOne({
    where: { Id: id },
    attributes: ["Id", "unit", "note", "status"],
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

  const normalizedPayload =
    unitValue === "" || unitValue == null
      ? null
      : toBaseStockPayload(
          unit === "" || unit == null ? existing.unit : unit,
          unitValue,
        );
  const totalUnitValue = normalizedPayload?.unitValue;
  const totalCost = cost === "" || cost == null ? undefined : toNumber(cost);

  const data = {
    itemId: itemId || undefined,
    productId: productId || undefined,
    name: name === "" || name == null ? undefined : name,
    unit: normalizedPayload ? normalizedPayload.unit : undefined,
    unitValue: totalUnitValue,
    cost: totalCost,
    supplierId,

    // unitCost:
    //   totalUnitValue && totalUnitValue > 0 && totalCost != null
    //     ? totalCost / totalUnitValue
    //     : undefined,
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
        url: "/kafelamart.digitalever.com.bd/StockAdjustment",
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const data = await StockAdjustment.findAll();
  return data.map(formatStockForDisplay);
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
