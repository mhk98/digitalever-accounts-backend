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
const Asset = db.asset;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const CashInOut = db.cashInOut;

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  if (!text || ["undefined", "null"].includes(text.toLowerCase())) {
    return null;
  }

  return text;
};

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const id = Number(value);
  return Number.isNaN(id) ? null : id;
};

const resolveRequisitionItem = async (
  { productId, assetId, assetName, existing = null },
  options = {},
) => {
  const normalizedProductId = normalizeOptionalId(productId);
  const normalizedAssetId = normalizeOptionalId(assetId);
  const normalizedAssetName = normalizeOptionalText(assetName);

  if (normalizedProductId) {
    const productData = await Product.findOne({
      where: { Id: normalizedProductId },
      transaction: options.transaction,
    });

    if (!productData) {
      throw new ApiError(404, "Product not found");
    }

    return {
      name: productData.name,
      productId: normalizedProductId,
      assetId: null,
    };
  }

  if (normalizedAssetId) {
    const assetData = await Asset.findOne({
      where: { Id: normalizedAssetId },
      transaction: options.transaction,
    });

    if (!assetData) {
      throw new ApiError(404, "Asset not found");
    }

    return {
      name: assetData.name,
      productId: null,
      assetId: normalizedAssetId,
    };
  }

  if (normalizedAssetName) {
    const [assetData] = await Asset.findOrCreate({
      where: { name: normalizedAssetName },
      defaults: { name: normalizedAssetName },
      transaction: options.transaction,
    });

    return {
      name: assetData.name,
      productId: null,
      assetId: assetData.Id,
    };
  }

  if (existing) {
    return {
      name: existing.name,
      productId: existing.productId || null,
      assetId: existing.assetId || null,
    };
  }

  throw new ApiError(400, "Product or asset is required");
};

const insertIntoDB = async (data) => {
  const {
    quantity,
    amount,
    variants,
    productId,
    assetId,
    assetName,
    newAssetName,
    name,
    userId,
    bookId,
    note,
    date,
    procurement,
    supplierId,
    warehouseId,
  } = data;

  const incomingVariants = parseVariants(variants);

  const finalStatus = "Pending";

  return db.sequelize.transaction(async (t) => {
    const item = await resolveRequisitionItem(
      {
        productId,
        assetId,
        assetName: assetName || newAssetName || name,
      },
      { transaction: t },
    );

    const payload = {
      name: item.name,
      procurement: procurement || null,
      quantity: Number(quantity),
      amount: Number(amount || 0),
      bookId: bookId || null,
      status: finalStatus, // সব নতুন রিকুয়েস্ট হবে Pending, পরে update route থেকে Approved/Completed করা যাবে
      note: finalStatus === "Approved" ? null : note || null,
      date: date,
      variants: incomingVariants,
      supplierId,
      warehouseId,
      productId: item.productId,
      assetId: item.assetId,
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
        finalStatus === "Approved"
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
      {
        model: Asset,
        as: "asset",
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
      {
        model: Asset,
        as: "asset",
        attributes: ["Id", "name"],
      },
    ],
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
    assetId,
    assetName,
    newAssetName,
    name,
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
  const existing = await PurchaseRequisition.findOne({
    where: { Id: id },
    attributes: ["Id", "note", "status", "name", "productId", "assetId"],
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
    quantity,
    amount: Number(amount || 0),
    bookId: bookId || null,
    variants: incomingVariants,
    note: finalStatus === "Approved" ? null : newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
    supplierId,
    warehouseId,
  };

  return db.sequelize.transaction(async (t) => {
    const item = await resolveRequisitionItem(
      {
        productId,
        assetId,
        assetName: assetName || newAssetName || name,
        existing,
      },
      { transaction: t },
    );

    data.name = item.name;
    data.productId = item.productId;
    data.assetId = item.assetId;

    if (status === "Completed") {
      // Handle completed status logic if needed

      await CashInOut.create(
        {
          amount: amount,
          bookId: bookId || null,
          paymentStatus: "CashInOut",
          status: "Active",
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
    include: [
      {
        model: Asset,
        as: "asset",
        attributes: ["Id", "name"],
      },
    ],
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
