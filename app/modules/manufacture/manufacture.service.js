const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ManufactureSearchableFields } = require("./manufacture.constants");
const Manufacture = db.manufacture;
const Notification = db.notification;
const User = db.user;
const Item = db.item;
const ItemMaster = db.itemMaster;

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

const resolveStatus = ({ status, date, note }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);
  const isApproved = String(status || "").trim() === "Approved";

  if (isApproved) return "Approved";
  if (inputDateStr && inputDateStr !== todayStr) return "Pending";
  if (String(note || "").trim()) return "Pending";
  return "Active";
};

const insertIntoDB = async (payload) => {
  const { itemId, productId, unit, unitValue, cost, date, note, status } =
    payload;

  const itemData = await Item.findOne({ where: { Id: itemId } });
  if (!itemData) throw new ApiError(404, "Item not found");

  const totalUnitValue = toNumber(unitValue);
  const totalCost = toNumber(cost);

  if (totalUnitValue <= 0) {
    throw new ApiError(400, "unitValue must be greater than 0");
  }

  const calculatedUnitCost =
    totalUnitValue > 0 ? totalCost / totalUnitValue : 0;
  const finalStatus = resolveStatus({ status, date, note });

  return db.sequelize.transaction(async (t) => {
    const manufactureData = {
      itemId,
      productId: productId || null,
      name: itemData.name,
      unit: unit || "Pcs",
      unitValue: totalUnitValue,
      cost: totalCost,
      unitCost: calculatedUnitCost,
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
      const nextQuantity = toNumber(stockRow.unitValue) + totalUnitValue;
      await stockRow.update(
        {
          itemId,
          productId: productId || stockRow.productId || null,
          name: itemData.name,
          unit: unit || stockRow.unit || "Pcs",
          unitValue: nextQuantity,
          unitCost: calculatedUnitCost,
          cost: nextQuantity * calculatedUnitCost,
        },
        { transaction: t },
      );
    } else {
      await ItemMaster.create(
        {
          itemId,
          productId: productId || null,
          name: itemData.name,
          unit: unit || "Pcs",
          unitValue: totalUnitValue,
          unitCost: calculatedUnitCost,
          cost: totalCost,
        },
        { transaction: t },
      );
    }

    return Manufacture.create(manufactureData, { transaction: t });
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ManufactureSearchableFields.map((field) => ({
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
    Manufacture.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    Manufacture.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data,
  };
};

const getDataById = async (id) => {
  return Manufacture.findAll({ where: { productId: id } });
};

const deleteIdFromDB = async (id) => {
  return Manufacture.destroy({ where: { Id: id } });
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

  const existing = await Manufacture.findOne({
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

  const [updatedCount] = await Manufacture.update(data, { where: { Id: id } });
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
      ? "Manufacture request approved"
      : newNote || "Manufacture updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: "/kafelamart.digitalever.com.bd/manufacture",
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  return Manufacture.findAll();
};

const ManufactureService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ManufactureService;
