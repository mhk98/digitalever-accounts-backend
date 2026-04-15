const { Op } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  PurchaseRequisitionSearchableFields,
} = require("./purchaseRequisition.constants");
const parseVariants = require("../../../shared/parseVariants");

const PurchaseRequisition = db.purchaseRequisition;
const Product = db.product;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const CashInOut = db.cashInOut;

const insertIntoDB = async (data) => {
  const {
    quantity,
    amount,
    variants,
    productId,
    userId,
    bookId,
    note,
    date,
    status,
    procurement,
    supplierId,
    warehouseId,
  } = data;

  const incomingVariants = parseVariants(variants);

  const productData = await Product.findOne({
    where: { Id: productId },
  });

  if (!productData) {
    throw new ApiError(404, "Product not found");
  }

  // const todayStr = new Date().toISOString().slice(0, 10);
  // const inputDateStr = String(date || "").slice(0, 10); // expects "YYYY-MM-DD"

  // // ✅ Approved হলে পুরোনো date-ও allow + save
  // const isApproved = String(status || "").trim() === "Approved";
  // const isCompleted = String(status || "").trim() === "Completed";

  // // ✅ current date না হলে auto Pending
  // const finalStatus = isApproved
  //   ? "Approved"
  //   : isCompleted
  //     ? "Completed"
  //     : inputDateStr !== todayStr
  //       ? "Pending"
  //       : note
  //         ? "Pending"
  //         : "Active";

  return db.sequelize.transaction(async (t) => {
    const payload = {
      name: productData.name,
      procurement: procurement || null,
      quantity: Number(quantity),
      amount: Number(amount || 0),
      bookId: bookId || null,
      status: "Pending", // সব নতুন রিকুয়েস্ট হবে Pending, পরে update route থেকে Approved/Completed করা যাবে
      note: note || null,
      date: date,
      variants: incomingVariants,
      supplierId,
      warehouseId,
      productId,
    };

    const result = await PurchaseRequisition.create(payload, {
      transaction: t,
    });

    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
      transaction: t,
    });

    if (users.length) {
      const message =
        status === "Approved"
          ? "Product purchase requision request approved"
          : note || "Product purchase requisition request";

      await Promise.all(
        users.map((u) =>
          Notification.create(
            {
              userId: u.Id,
              message,
              url: `/kafelamart.digitalever.com.bd/purchase-requisition`,
            },
            { transaction: t },
          ),
        ),
      );
    }

    return result;
  });
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
    variants,
    note,
    date,
    status,
    userId,
    supplierId,
    warehouseId,
    amount,
    bookId,
    actorRole,
  } = payload;

  const incomingVariants = parseVariants(variants);

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

  const data = {
    name: productData.name,
    quantity,
    amount: Number(amount || 0),
    bookId: bookId || null,
    variants: incomingVariants,
    note: newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
    supplierId,
    warehouseId,
    productId,
  };

  return db.sequelize.transaction(async (t) => {
    if (status === "Completed") {
      // Handle completed status logic if needed

      await CashInOut.create(
        {
          amount: amount,
          bookId: bookId || null,
          paymentStatus: "CashInOut",
          date: new Date(),
        },
        { transaction: t },
      );
    }

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
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await PurchaseRequisition.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

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
