const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  AssetsPurchaseSearchableFields,
} = require("./assetsPurchase.constants");
const AssetsPurchase = db.assetsPurchase;
const Notification = db.notification;
const User = db.user;

const insertIntoDB = async (payload) => {
  const { name, quantity, price, date } = payload;

  const data = {
    name,
    quantity,
    price,
    date,
    total: Number(price * quantity),
  };
  const result = await AssetsPurchase.create(data);
  return result;
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: AssetsPurchaseSearchableFields.map((field) => ({
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
      createdAt: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records
  andConditions.push({
    deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await AssetsPurchase.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true, // Ensure this is added to include soft deleted records
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await AssetsPurchase.count({ where: whereConditions });

  const [count, totalQuantity] = await Promise.all([
    AssetsPurchase.count({ where: whereConditions }),
    AssetsPurchase.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await AssetsPurchase.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

// const removeIdFromDB = async (id) => {
//   const result = await AssetsPurchase.findOne({
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
  const result = await AssetsPurchase.destroy({
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
//   const finalNote = finalStatus === "Approved" ? "-" : note;

//   const data = {
//     name: name === "" ? undefined : name,
//     quantity: q,
//     price: p,
//     note: finalNote,
//     status: finalStatus,
//     total: typeof p === "number" && typeof q === "number" ? p * q : undefined,
//   };

//   console.log("assetsPurchasePayload", payload);
//   console.log("assetsPurchaseData", data, id);

//   // ✅ update first
//   const [updatedCount] = await AssetsPurchase.update(data, {
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
  const { name, quantity, price, note, status, userId } = payload;

  console.log("data", payload);

  const q = quantity === "" || quantity == null ? undefined : Number(quantity);
  const p = price === "" || price == null ? undefined : Number(price);

  const finalStatus = status || "Pending";
  const finalNote = finalStatus === "Approved" ? "-" : note;

  const data = {
    name: name === "" ? undefined : name,
    quantity: q,
    price: p,
    note: finalNote,
    status: finalStatus,
    total: Number.isFinite(p) && Number.isFinite(q) ? p * q : undefined,
  };

  const [updatedCount] = await AssetsPurchase.update(data, {
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
          url: `http://localhost:5173/assets-purchase`,
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
  const result = await AssetsPurchase.findAll();

  return result;
};

const AssetsPurchaseService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = AssetsPurchaseService;
