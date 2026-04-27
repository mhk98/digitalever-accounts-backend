const { Op, where } = require("sequelize"); // Ensure Op is imported
const paginationHelpers = require("../../../helpers/paginationHelper");
const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const {
  ReceivedProductSearchableFields,
} = require("./receivedProduct.constants");
const {
  resolveApprovalNotificationMessage,
} = require("../../../shared/approvalNotification");
const mergeVariants = require("../../../shared/mergeVariants");
const parseVariants = require("../../../shared/parseVariants");
const subtractVariants = require("../../../shared/subtractVariants");

const ReceivedProduct = db.receivedProduct;
const Product = db.product;
const Notification = db.notification;
const User = db.user;
const Supplier = db.supplier;
const Warehouse = db.warehouse;
const InventoryMaster = db.inventoryMaster;
const WarrantyProduct = db.warrantyProduct;
const CashInOut = db.cashInOut;
const SupplierHistory = db.supplierHistory;

const normalizeNullableId = (value) => {
  if (value === undefined || value === null) return null;

  const trimmedValue = String(value).trim();
  return trimmedValue === "" ? null : trimmedValue;
};

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const insertIntoDB = async (data, file) => {
  const {
    quantity,
    productId,
    date,
    status,
    note,
    purchase_price,
    sale_price,
    warrantyValue,
    warrantyUnit,
    variants,
    sku,
    weight,
    userId,
    bookId,
    supplierId,
    warehouseId,
  } = data;

  console.log("ReceivedProduct", data);

  const productData = await Product.findOne({ where: { Id: productId } });
  if (!productData) throw new ApiError(404, "Product not found");

  // ✅ parse incoming variants
  const incomingVariants = parseVariants(variants);

  const finalStatus = String(status || "").trim() || "Active";

  return db.sequelize.transaction(async (t) => {
    // =========================
    // Create ReceivedProduct
    // =========================
    const payload = {
      name: productData.name,
      quantity,
      source: "Received Product",
      purchase_price: Number(purchase_price),
      sale_price: Number(sale_price),
      supplierId,
      warehouseId,
      productId,
      sku,
      weight,
      variants: incomingVariants,
      status: finalStatus || "---",
      note: finalStatus === "Approved" ? null : note || null,
      date,
    };

    const result = await ReceivedProduct.create(payload, { transaction: t });

    // =========================
    // SupplierHistory
    // =========================
    const normalizedBookId = normalizeNullableId(bookId);

    await SupplierHistory.create(
      {
        supplierId,
        bookId: normalizedBookId,
        amount: Number(purchase_price || 0) * Number(quantity || 0),
        date,
        file,
      },
      { transaction: t },
    );

    // =========================
    // CashInOut
    // =========================
    await CashInOut.create(
      {
        supplierId,
        bookId: normalizedBookId,
        paymentStatus: "Unpaid",
        amount: Number(purchase_price || 0) * Number(quantity || 0),
        status: "Active",
        date,
        file,
      },
      { transaction: t },
    );

    // =========================
    // InventoryMaster Update / Insert
    // =========================
    const inv = await InventoryMaster.findOne({
      where: { productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (inv) {
      const mergedVariants = mergeVariants(inv.variants, incomingVariants);

      await inv.update(
        {
          quantity: Number(inv.quantity || 0) + Number(quantity || 0),
          variants: mergedVariants,
          purchase_price: Number(purchase_price),
          sale_price: Number(sale_price),
        },
        { transaction: t },
      );

      if (!productData.stockId) {
        await Product.update(
          { stockId: inv.Id },
          {
            where: { Id: productId },
            transaction: t,
          },
        );
      }
    } else {
      const stock = await InventoryMaster.create(
        {
          productId,
          sku,
          weight,
          name: productData.name,
          quantity: Number(quantity || 0),
          variants: incomingVariants,
          purchase_price: Number(purchase_price),
          sale_price: Number(sale_price),
        },
        { transaction: t },
      );

      if (!productData.stockId) {
        await Product.update(
          { stockId: stock.Id },
          {
            where: { Id: productId },
            transaction: t,
          },
        );
      }
    }

    // =========================
    // Warranty
    // =========================
    if (Number(warrantyValue) > 0 && warrantyUnit) {
      await WarrantyProduct.create(
        {
          name: productData.name,
          price: Number(purchase_price),
          quantity,
          date,
          warrantyValue: Number(warrantyValue),
          warrantyUnit,
        },
        { transaction: t },
      );
    }

    // =========================
    // Notification
    // =========================
    const users = await User.findAll({
      attributes: ["Id", "role"],
      where: {
        Id: { [Op.ne]: userId },
        role: { [Op.in]: ["superAdmin", "admin", "inventor"] },
      },
      transaction: t,
    });

    if (users.length) {
      const message = resolveApprovalNotificationMessage({
        status: finalStatus,
        note,
        date,
        approvedMessage: "Received product request approved",
        fallbackMessage: "Please approve my request",
      });

      await Promise.all(
        users.map((u) =>
          Notification.create(
            {
              userId: u.Id,
              message,
              url: "/purchase-requisition",
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

// const deleteIdFromDB = async (id) => {
//   const result = await ReceivedProduct.destroy({
//     where: {
//       Id: id,
//     },
//   });

//   return result;
// };

const deleteIdFromDB = async (id, options = {}) => {
  const { skipInventoryAdjustment = false } = options;

  return db.sequelize.transaction(async (t) => {
    // ✅ 1) row খুঁজে বের করো
    const existing = await ReceivedProduct.findOne({
      where: { Id: id },
      attributes: [
        "Id",
        "productId",
        "quantity",
        "variants",
        "purchase_price",
        "sale_price",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) throw new ApiError(404, "Received product not found");

    const productId = Number(existing.productId);
    const qty = toNumber(existing.quantity);

    // ✅ 2) InventoryMaster subtract
    if (!skipInventoryAdjustment) {
      const inv = await InventoryMaster.findOne({
        where: { productId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (inv) {
        const nextQty = Number(inv.quantity || 0) - qty;
        const nextVariants = subtractVariants(inv.variants, existing.variants);

        if (nextQty < 0) {
          throw new ApiError(
            400,
            "This received product cannot be deleted because some of its stock has already been used.",
          );
        }

        await inv.update(
          {
            quantity: nextQty,
            variants: nextVariants,
          },
          { transaction: t },
        );
      }
    }

    // ✅ 3) ReceivedProduct delete (paranoid true হলে soft delete হবে)
    await ReceivedProduct.destroy({
      where: { Id: id },
      transaction: t,
    });

    return { deleted: true };
  });
};

const updateOneFromDB = async (id, payload) => {
  const {
    quantity,
    productId,
    note,
    status,
    date,
    sku,
    weight,
    userId,
    supplierId,
    bookId,
    warehouseId,
    purchase_price,
    sale_price,
    variants,
    actorRole,
    file,
  } = payload;

  const productData = await Product.findOne({
    where: { Id: productId },
  });

  if (!productData) throw new ApiError(404, "Product not found");

  const incomingVariants = parseVariants(variants);
  const todayStr = new Date().toISOString().slice(0, 10);
  const inputDateStr = String(date || "").slice(0, 10);
  const normalizedBookId = normalizeNullableId(bookId);

  return db.sequelize.transaction(async (t) => {
    // ✅ আগে পুরোনো ডাটা আনো (note পরিবর্তন ধরার জন্য)
    const existing = await ReceivedProduct.findOne({
      where: { Id: id },
      attributes: ["Id", "note", "status", "quantity", "productId", "variants"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existing) return 0;

    // const payableData = {
    //   supplierId,
    //   amount: paidAmount,
    //   date,
    //   file,
    // };

    // await Payable.create(payableData, { transaction: t });

    const qty = toNumber(existing.quantity);
    const nextQty = toNumber(quantity);
    const oldProductId = Number(existing.productId);
    const newProductId = Number(productId);
    const existingVariants = parseVariants(existing.variants);
    const oldNote = String(existing.note || "").trim();
    const newNote = String(note || "").trim();

    const noteTriggersPending = Boolean(newNote) && newNote !== oldNote;
    const dateTriggersPending =
      Boolean(inputDateStr) && inputDateStr !== todayStr;

    const inputStatus = String(status || "").trim();

    let finalStatus = existing.status || "Pending";
    const isPrivileged = actorRole === "superAdmin" || actorRole === "admin";

    if (isPrivileged) {
      finalStatus = inputStatus || finalStatus;
    } else {
      if (dateTriggersPending || noteTriggersPending) {
        finalStatus = "Pending";
      } else {
        finalStatus = inputStatus || finalStatus;
      }
    }

    const message = resolveApprovalNotificationMessage({
      status: finalStatus,
      note: newNote,
      date: inputDateStr,
      approvedMessage: "Purchase  product request approved",
      fallbackMessage: "Please approved my request",
    });

    const data = {
      name: productData.name,
      quantity: nextQty,
      purchase_price: Number(purchase_price || 0) * nextQty,
      sale_price: Number(sale_price || 0) * nextQty,
      supplierId,
      warehouseId,
      productId: newProductId,
      sku,
      weight,
      variants: incomingVariants,
      note: finalStatus === "Approved" ? null : newNote || null,
      status: finalStatus,
      date: inputDateStr || undefined,
      file,
    };

    // ✅ 2) InventoryMaster: quantity change হলে existing quantity এর diff অনুযায়ী adjust করো
    const oldInv = await InventoryMaster.findOne({
      where: { productId: oldProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!oldInv && oldProductId === newProductId) {
      throw new ApiError(404, "Inventory not found for this product");
    }

    if (oldProductId === newProductId) {
      const quantityDiff = nextQty - qty;
      const nextInventoryQty = toNumber(oldInv.quantity) + quantityDiff;

      if (nextInventoryQty < 0) {
        throw new ApiError(400, "Inventory cannot be negative");
      }

      const nextInventoryVariants = mergeVariants(
        subtractVariants(oldInv.variants, existingVariants),
        incomingVariants,
      );

      await oldInv.update(
        {
          name: productData.name,
          sku,
          weight,
          quantity: nextInventoryQty,
          variants: nextInventoryVariants,
          purchase_price: Number(purchase_price || 0),
          sale_price: Number(sale_price || 0),
        },
        { transaction: t },
      );
    } else {
      const reducedQty = toNumber(oldInv?.quantity) - qty;
      if (reducedQty < 0) {
        throw new ApiError(400, "Inventory cannot be negative");
      }

      if (oldInv) {
        await oldInv.update(
          {
            quantity: reducedQty,
            variants: subtractVariants(oldInv.variants, existingVariants),
          },
          { transaction: t },
        );
      }

      const targetInv = await InventoryMaster.findOne({
        where: { productId: newProductId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!targetInv) {
        await InventoryMaster.create(
          {
            name: productData.name,
            productId: newProductId,
            quantity: nextQty,
            sku,
            weight,
            variants: incomingVariants,
            purchase_price: Number(purchase_price || 0),
            sale_price: Number(sale_price || 0),
          },
          { transaction: t },
        );
      } else {
        const updatedVariants = mergeVariants(
          targetInv.variants,
          incomingVariants,
        );

        await targetInv.update(
          {
            name: productData.name,
            sku,
            weight,
            quantity: toNumber(targetInv.quantity) + nextQty,
            variants: updatedVariants,
            purchase_price: Number(purchase_price || 0),
            sale_price: Number(sale_price || 0),
          },
          { transaction: t },
        );
      }
    }

    const [updatedCount] = await ReceivedProduct.update(data, {
      where: { Id: id },
      transaction: t,
    });

    const supplierData = {
      supplierId,
      bookId: normalizedBookId,
      amount: Number(purchase_price || 0) * Number(quantity || 0),
      date,
      file,
    };

    await SupplierHistory.update(supplierData, {
      where: { supplierId },
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

    if (!users.length) return updatedCount;

    await Promise.all(
      users.map((u) =>
        Notification.create(
          {
            userId: u.Id,
            message,
            url: `/kafelamart.digitalever.com.bd/purchase-product`,
          },
          { transaction: t },
        ),
      ),
    );

    return updatedCount;
  });
};
const getAllFromDBWithoutQuery = async () => {
  const result = await ReceivedProduct.findAll({
    paranoid: true,
    order: [["createdAt", "DESC"]],
  });

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
