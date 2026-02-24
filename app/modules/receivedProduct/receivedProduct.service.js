const { Op, where } = require("sequelize"); // Ensure Op is imported
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
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;

const insertIntoDB = async (data) => {
  const {
    quantity,
    productId,
    date,
    status,
    note,
    userId,
    supplierId,
    warehouseId,
  } = data;

  const productData = await Product.findOne({ where: { Id: productId } });
  if (!productData) throw new ApiError(404, "Product not found");

  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);

  const isApproved = String(status || "").trim() === "Approved";

  const finalStatus = isApproved
    ? "Approved"
    : inputDateStr !== todayStr
      ? "Pending"
      : note
        ? "Pending"
        : "Active";

  return db.sequelize.transaction(async (t) => {
    const payload = {
      name: productData.name,
      quantity,
      purchase_price: productData.purchase_price * quantity,
      sale_price: productData.sale_price * quantity,
      price: Number(productData.sale_price || 0),
      supplierId,
      warehouseId,
      productId,
      status: finalStatus || "---",
      note: note || null,
      date: date,
    };

    const result = await ReceivedProduct.create(payload, { transaction: t });

    // ✅ InventoryMaster: থাকলে update, না থাকলে insert
    if (result) {
      const inv = await InventoryMaster.findOne({
        where: { productId },
        transaction: t,
        lock: t.LOCK.UPDATE, // optional but helpful
      });

      if (inv) {
        await inv.update(
          {
            quantity: Number(inv.quantity || 0) + Number(quantity || 0),
            purchase_price:
              Number(inv.purchase_price || 0) +
              Number(productData.purchase_price * quantity),
            sale_price:
              Number(inv.sale_price || 0) +
              Number(productData.sale_price * quantity),
          },
          { transaction: t },
        );
      } else {
        await InventoryMaster.create(
          {
            productId,
            name: productData.name,
            quantity: Number(quantity || 0),
            price: productData.sale_price,
            purchase_price: productData.purchase_price * quantity,
            sale_price: productData.sale_price * quantity,
          },
          { transaction: t },
        );
      }
    }

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
          ? "Received product request approved"
          : note || "Please approve my request";

      await Promise.all(
        users.map((u) =>
          Notification.create(
            { userId: u.Id, message, url: "/purchase-requisition" },
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
  const {
    quantity,
    productId,
    note,
    status,
    date,
    userId,
    supplierId,
    warehouseId,
    actorRole,
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
  const existing = await ReceivedProduct.findOne({
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

  const message =
    finalStatus === "Approved"
      ? "Purchase  product request approved"
      : note || "Please approved my request";

  const data = {
    name: productData.name,
    quantity,
    purchase_price: productData.purchase_price * quantity,
    sale_price: productData.sale_price * quantity,
    supplierId,
    warehouseId,
    productId,
    note: newNote || null,
    status: finalStatus,
    date: inputDateStr || undefined,
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
