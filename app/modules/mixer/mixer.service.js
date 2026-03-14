const { Op } = require("sequelize");
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { MixerSearchableFields } = require("./mixer.constants");
const Mixer = db.mixer;
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

const normalizeMaterialName = (value = "") =>
  String(value)
    .replace(/\s+\(Stock:\s*[^)]+\)\s*$/i, "")
    .trim();

const extractMixerMaterials = (note = "") => {
  return String(note)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^[^:]+:\s*(.+?)\s+x\s*([0-9]+(?:\.[0-9]+)?)$/i);
      if (!match) return null;

      const name = normalizeMaterialName(match[1]);
      const quantity = toNumber(match[2]);
      if (!name || quantity <= 0) return null;

      return { name, quantity };
    })
    .filter(Boolean);
};

const decrementItemMasterStock = async (materials, transaction) => {
  for (const material of materials) {
    const stockRow = await ItemMaster.findOne({
      where: db.Sequelize.where(
        db.Sequelize.fn("LOWER", db.Sequelize.col("name")),
        material.name.toLowerCase(),
      ),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!stockRow) {
      throw new ApiError(404, `${material.name} stock not found in ItemMaster`);
    }

    const availableQuantity = toNumber(stockRow.quantity || stockRow.unitValue);
    if (availableQuantity < material.quantity) {
      throw new ApiError(
        400,
        `${material.name} stock not enough. Available: ${availableQuantity}`,
      );
    }

    const nextQuantity = availableQuantity - material.quantity;

    await stockRow.update(
      {
        quantity: nextQuantity,
        unitValue: nextQuantity,
      },
      { transaction },
    );
  }
};

const insertIntoDB = async (payload) => {
  const { itemId, unit, unitValue, cost, date, note, status, productId } =
    payload;

  const itemData = await Item.findOne({ where: { Id: itemId } });
  if (!itemData) throw new ApiError(404, "Item not found");

  const totalUnitValue = toNumber(unitValue);
  const totalCost = toNumber(cost);
  const finalStatus = resolveStatus({ status, date, note });
  const materials = extractMixerMaterials(note);
  const calculatedUnitCost =
    totalUnitValue > 0 ? totalCost / totalUnitValue : 0;

  return db.sequelize.transaction(async (t) => {
    if (materials.length) {
      await decrementItemMasterStock(materials, t);
    }

    return Mixer.create(
      {
        itemId,
        productId,
        name: itemData.name,
        unit: unit || "Pcs",
        unitValue: totalUnitValue,
        cost: totalCost,
        unitCost: calculatedUnitCost,
        date,
        note: note || null,
        status: finalStatus,
      },
      { transaction: t },
    );
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: MixerSearchableFields.map((field) => ({
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
    Mixer.findAll({
      where: whereConditions,
      offset: skip,
      limit,
      paranoid: true,
      order:
        options.sortBy && options.sortOrder
          ? [[options.sortBy, options.sortOrder.toUpperCase()]]
          : [["createdAt", "DESC"]],
    }),
    Mixer.count({ where: whereConditions }),
  ]);

  return {
    meta: { page, limit, count },
    data,
  };
};

const getDataById = async (id) => {
  return Mixer.findOne({ where: { Id: id } });
};

const deleteIdFromDB = async (id) => {
  return Mixer.destroy({ where: { Id: id } });
};

const updateOneFromDB = async (id, payload) => {
  const {
    itemId,
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

  const existing = await Mixer.findOne({
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
  const itemData = itemId
    ? await Item.findOne({ where: { Id: itemId } })
    : null;

  const data = {
    itemId: itemId || undefined,
    name: itemData?.name || (name === "" || name == null ? undefined : name),
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

  const [updatedCount] = await Mixer.update(data, { where: { Id: id } });
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
      ? "Mixer request approved"
      : newNote || "Mixer updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: "/kafelamart.digitalever.com.bd/mixer",
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  return Mixer.findAll();
};

const MixerService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = MixerService;
