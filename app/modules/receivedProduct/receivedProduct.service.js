const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  ReceivedProductSearchableFields,
} = require("./receivedProduct.constants");

const ReceivedProduct = db.receivedProduct;
const Product = db.product;
const Notification = db.notification;
const User = db.user;

// const insertIntoDB = async (data) => {
//   const { quantity, productId, date, status, note } = data;

//   const productData = await Product.findOne({ where: { Id: productId } });
//   if (!productData) throw new ApiError(404, "Product not found");

//   const todayStr = new Date().toISOString().slice(0, 10);
//   const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

//   const payload = {
//     name: productData.name,
//     quantity,
//     purchase_price: productData.purchase_price * quantity,
//     sale_price: productData.sale_price * quantity,
//     supplier: productData.supplier,
//     productId,
//   };

//   const result = await ReceivedProduct.create(payload);
//   return result;
// };

// const getAllFromDB = async (filters, options) => {
//   const { page, limit, skip } = paginationHelpers.calculatePagination(options);

//   const { searchTerm, startDate, endDate, ...otherFilters } = filters;

//   const andConditions = [];

//   // ✅ Search (ILIKE on searchable fields)
//   if (searchTerm && searchTerm.trim()) {
//     andConditions.push({
//       [Op.or]: ReceivedProductSearchableFields.map((field) => ({
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

//   const result = await ReceivedProduct.findAll({
//     where: whereConditions,
//     offset: skip,
//     limit,
//     order:
//       options.sortBy && options.sortOrder
//         ? [[options.sortBy, options.sortOrder.toUpperCase()]]
//         : [["createdAt", "DESC"]],
//   });

//   const total = await ReceivedProduct.count({ where: whereConditions });

//   return {
//     meta: { total, page, limit },
//     data: result,
//   };
// };

const insertIntoDB = async (data) => {
  const { quantity, productId, date, status, note, userId } = data;

  const productData = await Product.findOne({ where: { Id: productId } });
  if (!productData) throw new ApiError(404, "Product not found");

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  // ✅ Approved হলে পুরোনো date-ও allow + save
  const isApproved = String(status || "").trim() === "Approved";

  // ✅ current date না হলে auto Pending
  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : null;

  const payload = {
    name: productData.name,
    quantity,
    purchase_price: Number(productData.purchase_price || 0),
    sale_price: Number(productData.sale_price || 0),
    supplier: productData.supplier,
    productId,
    status: finalStatus || "---",
    note: note || "---",
    date: date,
  };

  const result = await ReceivedProduct.create(payload);

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
        ? "Received product request approved"
        : note || "Please approved my request";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: "/purchase-requisition",
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
      [Op.or]: ReceivedProductSearchableFields.map((field) => ({
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
  const data = await ReceivedProduct.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // ✅ total count + total quantity (same filters)
  const [count, totalQuantity] = await Promise.all([
    ReceivedProduct.count({ where: whereConditions }),
    ReceivedProduct.sum("quantity", { where: whereConditions }),
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
  const result = await ReceivedProduct.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  const result = await ReceivedProduct.destroy({
    where: {
      Id: id,
    },
  });

  return result;
};

const updateOneFromDB = async (id, payload) => {
  const { quantity, productId, supplier, note, status, date, userId } = payload;

  const productData = await Product.findOne({
    where: {
      Id: productId,
    },
  });

  if (!productData) {
    throw new ApiError(404, "Product not found");
  }

  const data = {
    name: productData.name,
    quantity,
    purchase_price: productData.purchase_price * quantity,
    sale_price: productData.sale_price * quantity,
    supplier,
    productId,

    note: status === "Approved" ? "---" : note,
    status: status ? status : "Pending",
    date,
  };

  const [updatedCount] = await ReceivedProduct.update(data, {
    where: {
      Id: id,
    },
  });

  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId }, // sender বাদ
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] }, // তোমার DB অনুযায়ী ঠিক করো
    },
  });

  console.log("users", users.length);
  if (!users.length) return updatedCount;

  const message =
    finalStatus === "Approved"
      ? "Purchase  product request approved"
      : finalNote || "Please approved my request";

  await Promise.all(
    users.map((u) =>
      Notification.create({
        userId: u.Id,
        message,
        url: `http://localhost:5173/purchase-product`,
      }),
    ),
  );

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await ReceivedProduct.findAll();

  return result;
};

const ReceivedProductService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = ReceivedProductService;
