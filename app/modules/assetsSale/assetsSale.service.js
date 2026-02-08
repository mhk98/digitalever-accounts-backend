const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const { AssetsSaleSearchableFields } = require("./assetsSale.constants");
const AssetsSale = db.assetsSale;
const AssetsPurchase = db.assetsPurchase;
const Notification = db.notification;
const User = db.user;

const insertIntoDB = async (data) => {
  const { productId, quantity, price, date, note, status } = data;

  if (!quantity || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
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
      : null;

  return await db.sequelize.transaction(async (t) => {
    // ✅ PurchaseProduct (তোমার schema অনুযায়ী Id/productId adjust করো)
    const purchase = await AssetsPurchase.findOne({
      where: { Id: productId }, // যদি column থাকে productId, তাহলে where: { productId }
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!purchase) throw new ApiError(404, "Purchase asset product not found");

    // ✅ stock check
    if (purchase.quantity < quantity) {
      throw new ApiError(
        400,
        `Not enough stock. Available: ${purchase.quantity}`,
      );
    }

    const oldQty = Number(purchase.quantity);
    const saleQty = Number(quantity);

    // ✅ AssetsPurchase create (return amount)
    const payload = {
      name: purchase.name,
      quantity: saleQty,
      price,
      total: price * quantity,
      productId,
      status: finalStatus || "---",
      note: note || "---",
      date: date,
    };

    const result = await AssetsSale.create(payload, {
      transaction: t,
    });

    // ✅ AssetsPurchase update (qty & prices reduce)
    const newQty = oldQty - saleQty;

    await AssetsPurchase.update(
      {
        quantity: newQty,
        total: purchase.price * newQty,
      },
      {
        where: { Id: purchase.Id }, // যদি productId হয়: where: { productId }
        transaction: t,
      },
    );

    return result;
  });
};

const getAllFromDB = async (filters, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  const { searchTerm, startDate, endDate, ...otherFilters } = filters;

  const andConditions = [];

  // ✅ Search (ILIKE on searchable fields)
  if (searchTerm && searchTerm.trim()) {
    andConditions.push({
      [Op.or]: AssetsSaleSearchableFields.map((field) => ({
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

  const result = await AssetsSale.findAll({
    where: whereConditions,
    offset: skip,
    limit,
    paranoid: true,
    order:
      options.sortBy && options.sortOrder
        ? [[options.sortBy, options.sortOrder.toUpperCase()]]
        : [["createdAt", "DESC"]],
  });

  // const total = await AssetsSale.count({ where: whereConditions });

  const [count, totalQuantity] = await Promise.all([
    AssetsSale.count({ where: whereConditions }),
    AssetsSale.sum("quantity", { where: whereConditions }),
  ]);

  return {
    meta: { count, totalQuantity: totalQuantity || 0, page, limit },
    data: result,
  };
};

const getDataById = async (id) => {
  const result = await AssetsSale.findOne({
    where: {
      Id: id,
    },
  });

  return result;
};

const deleteIdFromDB = async (id) => {
  return await db.sequelize.transaction(async (t) => {
    // 1) Sale row বের করো
    const sale = await AssetsSale.findOne({
      where: { Id: id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!sale) throw new ApiError(404, "AssetsSale not found");

    const saleQty = Number(sale.quantity || 0);
    if (saleQty <= 0) throw new ApiError(400, "Invalid sale quantity");

    // 2) Purchase row বের করো (sale.productId = AssetsPurchase.Id)
    const purchase = await AssetsPurchase.findOne({
      where: { Id: sale.productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!purchase) throw new ApiError(404, "AssetsPurchase not found");

    // 3) Purchase এ quantity ফিরিয়ে দাও + total re-calc
    const newQty = Number(purchase.quantity || 0) + saleQty;

    await AssetsPurchase.update(
      {
        quantity: newQty,
        total: Number(purchase.price || 0) * newQty,
      },
      { where: { Id: purchase.Id }, transaction: t },
    );

    // 4) Sale delete
    await AssetsSale.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

const updateOneFromDB = async (id, data) => {
  const { productId, quantity, price, note, status, userId } = data;

  if (!quantity || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  return await db.sequelize.transaction(async (t) => {
    // ✅ PurchaseProduct (তোমার schema অনুযায়ী Id/productId adjust করো)
    const purchase = await AssetsPurchase.findOne({
      where: { Id: productId }, // যদি column থাকে productId, তাহলে where: { productId }
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!purchase) throw new ApiError(404, "Received product not found");

    // ✅ stock check
    if (purchase.quantity < quantity) {
      throw new ApiError(
        400,
        `Not enough stock. Available: ${purchase.quantity}`,
      );
    }

    const oldQty = Number(purchase.quantity);
    const saleQty = Number(quantity);

    // ✅ AssetsPurchase create (return amount)
    const payload = {
      name: purchase.name,
      quantity: saleQty,
      price,
      note: status === "Approved" ? "---" : note,
      status: status ? status : "Pending",
      total: price * quantity,
      productId,
    };

    const [updatedCount] = await AssetsSale.update(payload, {
      where: { Id: id },

      transaction: t,
    });

    // ✅ AssetsPurchase update (qty & prices reduce)
    if (status === "Approved") {
      const newQty = oldQty - saleQty;

      await AssetsPurchase.update(
        {
          quantity: newQty,
          total: purchase.price * newQty,
        },
        {
          where: { Id: purchase.Id },
          transaction: t,
        },
      );
    }

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
        ? "Assets sale request approved"
        : finalNote || "Assets sale updated";

    await Promise.all(
      users.map((u) =>
        Notification.create(
          {
            userId: u.Id,
            message,
            url: `http://localhost:5173/assets-sale`,
          },
          {
            transaction: t,
          },
        ),
      ),
    );

    return updatedCount;
  });
};

const getAllFromDBWithoutQuery = async () => {
  const result = await AssetsSale.findAll();

  return result;
};

const AssetsSaleService = {
  getAllFromDB,
  insertIntoDB,
  deleteIdFromDB,
  updateOneFromDB,
  getDataById,
  getAllFromDBWithoutQuery,
};

module.exports = AssetsSaleService;
