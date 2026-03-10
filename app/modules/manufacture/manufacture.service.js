const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ManufactureSearchableFields } = require("./manufacture.constants");
const Manufacture = db.Manufacture;
const Notification = db.notification;
const User = db.user;

const insertIntoDB = async (payload) => {
  const { name, unit, unitValue, cost, date, note, status } = payload;
  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  // ✅ Approved হলে পুরোনো date-ও allow + save
  const isApproved = String(status || "").trim() === "Approved";

  // ✅ current date না হলে auto Pending
  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : note
        ? "Pending"
        : "Active";

  const data = {
    name,
    unit,
    unitValue,
    unitCost: Number(cost) / Number(unit), // Calculate unit cost
    date,
    note: note || null,
    status: finalStatus,
  };
  const result = await Manufacture.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: ManufactureSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ Exact filters (e.g. name)
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range filter (createdAt)
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await Manufacture.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true, // Ensure this is added to include soft deleted records
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await Manufacture.count({ where: whereConditions });

  // const [count, totalQuantity] = await Promise.all([
  //   Manufacture.count({ where: whereConditions }),
  //   Manufacture.sum("quantity", { where: whereConditions }),
  // ]);

  return {
    meta: { page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await Manufacture.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

// const removeIdFromDB = async (id) => {
//   const result = await Manufacture.findOne({
//     where: {
//       Id: id,
//     },
//   });

//   if (!result) {
//     throw new ApiError(404, "Asset purchase data not found");
//   }

//   // Soft delete by updating `deletedAt`
//   result.deletedAt = new Date(); // Set current timestamp
//   await result.save(); // Save the updated product with the deleted timestamp

//   return result;
// };

const deleteIdFromDB = async (id) => {
  const result = await Manufacture.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

// const updateOneFromDB = async (id, payload) => {
//   const { name, quantity, price, note, status, userId } = payload;

//   console.log("data", payload);

//   const q = quantity === "" || quantity == null ? undefined : Number(quantity);
//   const p = price === "" || price == null ? undefined : Number(price);

//   const finalStatus = status || "Pending";
//   const finalNote = finalStatus === "Approved" ? "---" : note;

//   const data = {
//     name: name === "" ? undefined : name,
//     quantity: q,
//     price: p,
//     note: finalNote,
//     status: finalStatus,
//     total: Number.isFinite(p) && Number.isFinite(q) ? p * q : undefined,
//   };

//   const [updatedCount] = await Manufacture.update(data, {
//     where: { Id: id },
//   });

//   // ✅ update না হলে এখানেই থামো
//   if (updatedCount <= 0) return updatedCount;

//   // ✅ শুধু admin/superAdmin/inventory রোলের ইউজার
//   const users = await User.findAll({
//     attributes: ["Id", "role"],
//     where: {
//       Id: { [Op.ne]: userId }, // sender বাদ
//       role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
//     },
//     transaction: t,
//   });

//   console.log("users", users.length);
//   if (!users.length) return updatedCount;

//   const message =
//     finalStatus === "Approved"
//       ? "Assets purchase request approved"
//       : finalNote || "Assets purchase updated";

//   await Promise.all(
//     users.map((u) =>
//       Notification.create(
//         {
//           userId: u.Id,
//           message,
//           url: `/kafelamart.digitalever.com.bd/assets-purchase`,
//         },
//         {
//           transaction: t,
//         },
//       ),
//     ),
//   );

//   return updatedCount;
// };

const updateOneFromDB = async (id, payload) => {
  const { name, unit, unitValue, cost, note, date, status, userId, actorRole } =
    payload;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await Manufacture.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status"],
  });

  if (!existing) return 0;

  const oldNote = String(existing.note || "").trim();
  const newNote = String(note || "").trim();

  // ✅ newNote খালি না হলে + oldNote থেকে আলাদা হলে => pending trigger
  const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;

  // ✅ today না হলে pending trigger (date না পাঠালে trigger হবে না)
  const dateTriggersPending =
    Boolean(inputDateStr) && inputDateStr !== todayStr;

  const inputStatus = String(status || "").trim();

  let finalStatus = existing.status || "Pending";

  const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

  if (isPrivileged) {
    // ✅ superAdmin/admin: যা পাঠাবে সেটাই
    finalStatus = inputStatus || finalStatus;
  } else {
    // ✅ others: today date না হলে বা new note হলে Pending override
    if (dateTriggersPending || noteTriggersPending) {
      finalStatus = "Pending";
    } else {
      // ✅ otherwise: status পাঠালে সেটাই, না পাঠালে আগেরটা
      finalStatus = inputStatus || finalStatus;
    }
  }

  // ---------- update payload ----------
  const data = {
    name: name === "" || name == null ? undefined : name,
    unit: unit === "" || unit == null ? undefined : Number(unit),
    unitValue:
      unitValue === "" || unitValue == null ? undefined : String(unitValue), // Store as string
    unitCost:
      cost === "" || cost == null ? undefined : Number(cost) / Number(unit),
    note: newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
  };

  const [updatedCount] = await Manufacture.update(data, {
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
      ? "Assets purchase request approved"
      : newNote || "Assets purchase updated";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/kafelamart.digitalever.com.bd/assets-purchase`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await Manufacture.findAll();

  return result;
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
