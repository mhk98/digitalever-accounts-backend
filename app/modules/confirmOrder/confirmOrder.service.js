const { Op, where, fn, col, literal } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { ConfirmOrderSearchableFields } = require("./confirmOrder.constants");

const ConfirmOrder = db.confirmOrder;
const ReceivedProduct = db.receivedProduct;
const Product = db.product;
const Notification = db.notification;
const User = db.user;
const Sequelize = db.Sequelize;
const WarrantyProduct = db.warrantyProduct;
const Supplier = db.supplier;
const Warehouse = db.warehouse;

const insertIntoDB = async (data) => {
  const {
    quantity,
    receivedId,
    date,
    note,
    status,
    userId,
    warrantyValue,
    warrantyUnit,
    supplierId,
    warehouseId,
  } = data;

  const productData = await Product.findOne({
    where: {
      Id: receivedId,
    },
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
    quantity,
    purchase_price: productData.purchase_price * quantity,
    sale_price: productData.sale_price * quantity,
    supplierId,
    warehouseId,
    productId: receivedId,
    status: finalStatus || "---",
    note: note || null,
    date: date,
  };

  const result = await ConfirmOrder.create(payload);

  if (result) {
    await WarrantyProduct.create({
      name: productData.name,
      quantity,
      price: productData.sale_price * quantity,
      date: date,
      warrantyValue,
      warrantyUnit,
    });
  }

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
          url: "/confirm-order",
        }),
      ),
    );
  }
  return result;
};

// const getAllFromDB = async (filters, options) => {
//   const { page, limit, skip } = paginationHelpers.calculatePagination(options);

//   const { searchTerm, startDate, endDate, ...otherFilters } = filters;

//   const andConditions = [];

//   // ✅ Search (ILIKE on searchable fields)
//   if (searchTerm && searchTerm.trim()) {
//     andConditions.push({
//       [Op.or]: ConfirmOrderSearchableFields.map((field) => ({
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
//       date: { [Op.between]: [start, end] },
//     });
//   }

//   // ✅ Exclude soft deleted records
//   andConditions.push({
//     deletedAt: { [Op.is]: null }, // Only include records with deletedAt as null (not deleted)
//   });

//   const whereConditions = andConditions.length
//     ? { [Op.and]: andConditions }
//     : {};

//   const result = await ConfirmOrder.findAll({
//     where: whereConditions,
//     offset: skip,
//     limit,
//     paranoid: true,
//     order:
//       options.sortBy && options.sortOrder
//         ? [[options.sortBy, options.sortOrder.toUpperCase()]]
//         : [["createdAt", "DESC"]],
//   });

//   // const total = await ConfirmOrder.count({ where: whereConditions });

//   // ✅ total count + total quantity (same filters)
//   const [count, totalQuantity] = await Promise.all([
//     ConfirmOrder.count({ where: whereConditions }),
//     ConfirmOrder.sum("quantity", { where: whereConditions }),
//   ]);

//   return {
//     meta: { count, totalQuantity: totalQuantity || 0, page, limit },
//     data: result,
//   };
// };

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (MariaDB compatible, case-insensitive)
  if (searchTerm && searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();

    andConditions.push({
      [Op.or]: ConfirmOrderSearchableFields.map((field) =>
        Sequelize.where(Sequelize.fn("LOWER", Sequelize.col(field)), {
          [Op.like]: `%${q}%`,
        }),
      ),
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

  // ✅ Date range filter (তোমার কোডে field name date আছে)
  // যদি আসলে createdAt দিয়ে filter করতে চাও, তাহলে "date" -> "createdAt" করে দিও।
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    andConditions.push({
      date: { [Op.between]: [start, end] },
    });
  }

  // ✅ Exclude soft deleted records (paranoid true থাকলে এটা লাগেই না, তবু রেখে দিলাম)
  andConditions.push({
    deletedAt: { [Op.is]: null },
  });

  const whereConditions = andConditions.length
    ? { [Op.and]: andConditions }
    : {};

  const result = await ConfirmOrder.findAll({
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

  const [count, totalQuantity] = await Promise.all([
    ConfirmOrder.count({ where: whereConditions }),
    ConfirmOrder.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getTrendingProductsFromDB = async (query) => {
  const days = Number(query?.days || 7);
  const limit = Number(query?.limit || 10);
  const sortBy = String(query?.sortBy || "soldQty"); // soldQty | revenue

  if (!Number.isFinite(days) || days <= 0) {
    throw new ApiError(400, "days must be a positive number");
  }

  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const result = await ConfirmOrder.findAll({
    attributes: [
      "productId",
      [fn("SUM", col("ConfirmOrder.quantity")), "soldQty"],
      [fn("SUM", col("ConfirmOrder.sale_price")), "revenue"],
    ],
    where: {
      date: { [Op.between]: [fromStr, toStr] },
      status: { [Op.in]: ["Approved", "Active"] },
    },
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["Id", "name"],
        required: false,
      },
    ],
    group: ["ConfirmOrder.productId", "product.Id", "product.name"],
    order: [[literal(sortBy === "revenue" ? "revenue" : "soldQty"), "DESC"]],
    limit,
  });

  return {
    meta: {
      days,
      from: fromStr,
      to: toStr,
      limit,
      sortBy: sortBy === "revenue" ? "revenue" : "soldQty",
    },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await ConfirmOrder.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Return row খুঁজে বের করো
    const ret = await ConfirmOrder.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!ret) throw new ApiError(404, "Return product not found");

    const qty = Number(ret.quantity || 0);
    if (qty <= 0) throw new ApiError(400, "Invalid return quantity");

    // 2) ReceivedProduct খুঁজে বের করো (Products.Id দিয়ে)
    const received = await ReceivedProduct.findOne({
      where: { productId: ret.productId }, // ✅ Products.Id
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!received) throw new ApiError(404, "Received product not found");

    // 3) stock ফিরিয়ে দাও
    await ReceivedProduct.update(
      {
        quantity: Number(received.quantity || 0) + qty,
        purchase_price:
          Number(received.purchase_price || 0) +
          Number(ret.purchase_price || 0),
        sale_price:
          Number(received.sale_price || 0) + Number(ret.sale_price || 0),
      },
      { where: { Id: received.Id }, transaction: t },
    );

    // 4) Return row delete
    await ConfirmOrder.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

const updateOneFromDB = async (id, data) => {
  const {
    quantity,
    receivedId,
    note,
    status,
    userId,
    date,
    supplierId,
    warehouseId,
    actorRole,
  } = data;

  const productData = await Product.findOne({ where: { Id: receivedId } });
  if (!productData) throw new ApiError(404, "Product not found");

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  const existing = await ConfirmOrder.findOne({
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

  const payload = {
    name: productData.name,
    quantity,
    purchase_price: productData.purchase_price * quantity,
    sale_price: productData.sale_price * quantity,
    supplierId,
    warehouseId,
    productId: receivedId,
    note: newNote || null, // ✅ newNote "" হলে null যাবে
    status: finalStatus,
    date: inputDateStr || null,
  };

  const [updatedCount] = await ConfirmOrder.update(payload, {
    where: { Id: id },
  });

  // notification (optional)
  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: userId },
      role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
    },
  });

  if (users.length) {
    const message =
      finalStatus === "Approved"
        ? "Confirm order request approved"
        : finalStatus === "Pending"
          ? "Confirm order moved to pending"
          : "Confirm order updated";

    await Promise.all(
      users.map((u) =>
        Notification.create({
          userId: u.Id,
          message,
          url: `/kafelamart.digitalever.com.bd/confirm-order`,
        }),
      ),
    );
  }

  return updatedCount;
};

const getAllFromDBWithoutQuery = async () => {
  const result = await ConfirmOrder.findAll();

  return result;
};

const ConfirmOrderService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
  getTrendingProductsFromDB,
};

module.exports = ConfirmOrderService;
