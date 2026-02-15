const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  AssetsRequisitionSearchableFields,
} = require("./assetsRequisition.constants");
const AssetsRequisition = db.assetsRequisition;
const Notification = db.notification;
const User = db.user;

const insertIntoDB = async (payload) => {
  const { name, quantity, price, date, note, status, userId } = payload;

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  // ✅ Approved হলে পুরোনো date-ও allow + save
  const isApproved = String(status || "").trim() === "Approved";

  // ✅ current date না হলে auto Pending
  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : "Pending";

  const data = {
    name,
    quantity,
    price,
    date,
    total: Number(price * quantity),
    status: finalStatus || "---",
    note: note || "---",
    date: date,
  };
  const result = await AssetsRequisition.create(data);

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (users.length) {
    const message =
      status === "Approved"
        ? "Assets requisition request approved"
        : note || "Please accpet my assets requisition request";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/apikafela.digitalever.com.bd/assets-requisition`,
        }),
      ),
    );
  }

  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: AssetsRequisitionSearchableFields.map((field) => ({
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

  const result = await AssetsRequisition.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true, // Ensure this is added to include soft deleted records
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await AssetsRequisition.count({ where: whereConditions });

  const [count, totalQuantity] = await Promise.all([
    AssetsRequisition.count({ where: whereConditions }),
    AssetsRequisition.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await AssetsRequisition.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

// const removeIdFromDB = async (id) => {
//   const result = await AssetsRequisition.findOne({
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
  const result = await AssetsRequisition.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

// const updateOneFromDB = async (id, payload) => {
//   const { name, quantity, price, note, status, userId } = payload;

//   const q = quantity === "" || quantity == null ? undefined : Number(quantity);
//   const p = price === "" || price == null ? undefined : Number(price);

//   const finalStatus = status ? status : "Pending";
//   const finalNote = finalStatus === "Approved" ? "---" : note;

//   const data = {
//     name: name === "" ? undefined : name,
//     quantity: q,
//     price: p,
//     note: finalNote,
//     status: finalStatus,
//     total: typeof p === "number" && typeof q === "number" ? p * q : undefined,
//   };

//   console.log("AssetsRequisitionPayload", payload);
//   console.log("AssetsRequisitionData", data, id);

//   // ✅ update first
//   const [updatedCount] = await AssetsRequisition.update(data, {
//     where: { Id: id },
//   });

//   const users = await User.findAll({
//     where: {
//       id: { [Op.ne]: userId }, // 👈 Exclude sender
//       role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
//     },
//   });

//   if (!users.length) {
//     console.log("No users found for notification.");
//     return [];
//   }

//   if (updatedCount > 0) {
//     await Promise.all(
//       users.map((user) =>
//         Notification.create({
//           userId: user.id,
//           message:
//             finalStatus === "Approved"
//               ? `Approved inventors request for assets purchase`
//               : `${finalNote}`,
//           url: "/assets-purchase",
//         }),
//       ),
//     );
//   }

//   return updatedCount; // অথবা return { updatedCount }
// };

const updateOneFromDB = async (id, payload) => {
  const { name, quantity, price, note, date, status, userId } = payload;

  console.log("data", payload);

  const q = quantity === "" || quantity == null ? undefined : Number(quantity);
  const p = price === "" || price == null ? undefined : Number(price);

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  // ✅ Approved হলে পুরোনো date-ও allow + save
  const isApproved = String(status || "").trim() === "Approved";

  // ✅ current date না হলে auto Pending
  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : "Pending";

  const data = {
    name: name === "" ? undefined : name,
    quantity: q,
    price: p,
    note: finalNote || "---",
    status: finalStatus,
    total: Number.isFinite(p) && Number.isFinite(q) ? p * q : undefined,
  };

  const [updatedCount] = await AssetsRequisition.update(data, {
    where: { Id: id },
  });

  // ✅ update না হলে এখানেই থামো
  if (updatedCount <= 0) return updatedCount;

  // ✅ শুধু admin/superAdmin/inventory রোলের ইউজার
  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId }, // sender বাদ
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
    },
    transaction: t,
  });

  console.log("users", users.length);
  if (!users.length) return updatedCount;

  const message =
    finalStatus === "Approved"
      ? "Assets purchase request approved"
      : finalNote || "Assets purchase updated";

  await Promise.all(
    users.map((u) =>
      Notification.create(
        {
          userId: u.Id,
          message,
          url: `/apikafela.digitalever.com.bd/assets-purchase`,
        },
        {
          transaction: t,
        },
      ),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await AssetsRequisition.findAll();

  return result;
};

const AssetsRequisitionService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = AssetsRequisitionService;
