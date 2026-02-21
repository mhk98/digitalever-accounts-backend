const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  PurchaseRequisitionSearchableFields,
} = require("./purchaseRequisition.constants");

const PurchaseRequisition = db.purchaseRequisition;
const Product = db.product;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;

// const insertIntoDB = async (data) => {
//   const { quantity, productId, userId, remarks, status } = data;

//   const productData = await Product.findOne({
//     where: {
//       Id: productId,
//     },
//   });

//   if (!productData) {
//     throw new ApiError(404, "Product not found");
//   }

//   const payload = {
//     name: productData.name,
//     quantity,
//     remarks,
//     purchase_price: productData.purchase_price * quantity,
//     supplier: productData.supplier,
//     productId,
//   };

//   const [updatedCount] = await PurchaseRequisition.create(payload);

//   const users = await User.findAll({
//     attributes: ["Id", "role"],
//     where: {
//       Id: { [Op.ne]: userId }, // sender বাদ
//       role: { [Op.in]: ["superAdmin", "admin"] }, // তোমার DB অনুযায়ী ঠিক করো
//     },
//   });

//   console.log("users", users.length);
//   if (!users.length) return updatedCount;

//   const message =
//     status === "Approved"
//       ? "Product purchase request approved"
//       : status || "Product purchase updated";

//   await Promise.all(
//     users.map((u) =>
//       Notification.create({
//         userId: u.Id,
//         message,
//         url: `/kafelamart.digitalever.com.bd/purchase-requisition`,
//       }),
//     ),
//   );

//   return result;
// };

// const getAllFromDB = async (filters, options) => {
//   const { page, limit, skip } = paginationHelpers.calculatePagination(options);

//   const { searchTerm, startDate, endDate, ...otherFilters } = filters;

//   const andConditions = [];

//   // ✅ Search (ILIKE on searchable fields)
//   if (searchTerm && searchTerm.trim()) {
//     andConditions.push({
//       [Op.or]: PurchaseRequisitionSearchableFields.map((field) => ({
//         [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
//       })),
//     });
//   }

//   // ✅ Exact filters (e.g. name)
//   if (Object.keys(otherFilters).length) {
//     andConditions.push(
//       ...Object.entries(otherFilters).map(([key, value]) => ({
//         [key]: { [Op.eq]: value },
//       })),
//     );
//   }

//   // ✅ Date range filter (createdAt)
//   if (startDate && endDate) {
//     const start = new Date(startDate);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     andConditions.push({
//       createdAt: { [Op.between]: [start, end] },
//     });
//   }

//   const whereConditions = andConditions.length
//     ? { [Op.and]: andConditions }
//     : {};

//   const result = await PurchaseRequisition.findAll({
//     where: whereConditions,
//     offset: skip,
//     limit,
//     order:
//       options.sortBy && options.sortOrder
//         ? [[options.sortBy, options.sortOrder.toUpperCase()]]
//         : [["createdAt", "DESC"]],
//   });

//   const total = await PurchaseRequisition.count({ where: whereConditions });

//   return {
//     meta: { total, page, limit },
//     data: result,
//   };
// };

const insertIntoDB = async (data) => {
  const {
    quantity,
    productId,
    userId,
    note,
    date,
    status,
    supplierId,
    warehouseId,
  } = data;

  const productData = await Product.findOne({
    where: { Id: productId },
  });

  if (!productData) {
    throw new ApiError(404, "Product not found");
  }

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

  const payload = {
    name: productData.name,
    quantity: Number(quantity),
    status: finalStatus || "---",
    note: note || null,
    date: date,
    purchase_price:
      Number(productData.purchase_price || 0) * Number(quantity || 0),
    supplierId,
    warehouseId,
    productId,
  };

  // ✅ create returns instance (not array)
  const result = await PurchaseRequisition.create(payload);

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
        ? "Product purchase requision request approved"
        : note || "Product purchase requisition request";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/kafelamart.digitalever.com.bd/purchase-requisition`,
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

  // ✅ Search (ILIKE)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: PurchaseRequisitionSearchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${searchTerm.trim()}%` },
      })),
    });
  }

  // ✅ Exact filters
  if (Object.keys(otherFilters).length) {
    andConditions.push(
      ...Object.entries(otherFilters).map(([key, value]) => ({
        [key]: { [Op.eq]: value },
      })),
    );
  }

  // ✅ Date range
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

  // ✅ paginated data
  const data = await PurchaseRequisition.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    include: [
      {
        model: Supplier,
        as: "supplier",
        attributes: ["Id", "name"],
      },
      {
        model: Warehouse,
        as: "warehouse",
        attributes: ["Id", "name"],
      },
    ],
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    PurchaseRequisition.count({ where: whereConditions }),
    PurchaseRequisition.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: {
      count, // total filtered records
      totalQuantity: totalQuantity || 0, // total filtered quantity
      page,
      limit,
    },
    data,
  };
};

const getDataById = async (id) => {
  const result = await PurchaseRequisition.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await PurchaseRequisition.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const {
    quantity,
    productId,
    note,
    date,
    status,
    userId,
    supplierId,
    warehouseId,
  } = payload;

  const productData = await Product.findOne({
    where: {
      Id: productId,
    },
  });

  if (!productData) {
    throw new ApiError(404, "Product not found");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await PurchaseRequisition.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status"],
  });

  if (!existing) return 0;

  const oldNote = String(existing.note || "").trim();
  const newNote = String(note || "").trim();
  const isNoteChanged = newNote && newNote !== oldNote;

  // ---------- status rules ----------
  const isApproved = String(status || "").trim() === "Approved";

  // ✅ current date না হলে status সবসময় Pending
  // ✅ today হলে: Approved থাকবে শুধু তখনই যখন Approved + note change হয়নি
  const finalStatus =
    inputDateStr !== todayStr
      ? "Pending"
      : isApproved && !isNoteChanged
        ? "Approved"
        : "Pending";

  const data = {
    name: productData.name,
    quantity,
    purchase_price: productData.purchase_price * quantity,
    sale_price: productData.sale_price * quantity,
    note: newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
    supplierId,
    warehouseId,
    productId,
  };

  const [updatedCount] = await PurchaseRequisition.update(data, {
    where: {
      Id: id,
    },
  });

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId }, // sender বাদ
      role: { [Op.in]: ["superAdmin", "admin"] }, // তোমার DB অনুযায়ী ঠিক করো
    },
  });

  console.log("users", users.length);
  if (!users.length) return updatedCount;

  const message =
    status === "Approved"
      ? "Product purchase requision request approved"
      : note || "Product purchase requisition request";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `/kafelamart.digitalever.com.bd/purchase-product`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await PurchaseRequisition.findAll();

  return result;
};

const PurchaseRequisitionService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = PurchaseRequisitionService;
