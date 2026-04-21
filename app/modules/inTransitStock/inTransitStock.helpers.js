const db = require("../../../models");
const ApiError = require("../../../error/ApiError");
const mergeVariants = require("../../../shared/mergeVariants");
const subtractVariants = require("../../../shared/subtractVariants");

const InTransitStock = db.inTransitStock;

const findInTransitStockByProductId = async (productId, transaction) =>
  InTransitStock.findOne({
    where: { productId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

const addInTransitStock = async (
  inventory,
  quantity,
  variants,
  purchasePrice,
  salePrice,
  transaction,
) => {
  const productId = Number(inventory?.productId);
  const qty = Number(quantity || 0);

  if (!productId) {
    throw new ApiError(400, "InventoryMaster.productId missing (Products.Id)");
  }
  if (qty <= 0) throw new ApiError(400, "Invalid intransit quantity");

  const stock = await findInTransitStockByProductId(productId, transaction);

  if (stock) {
    await stock.update(
      {
        quantity: Number(stock.quantity || 0) + qty,
        variants: mergeVariants(stock.variants, variants),
        purchase_price:
          Number(stock.purchase_price || 0) + Number(purchasePrice || 0),
        sale_price: Number(stock.sale_price || 0) + Number(salePrice || 0),
      },
      { transaction },
    );
    return stock;
  }

  return InTransitStock.create(
    {
      productId,
      name: inventory.name,
      quantity: qty,
      variants,
      purchase_price: Number(purchasePrice || 0),
      sale_price: Number(salePrice || 0),
    },
    { transaction },
  );
};

const subtractInTransitStock = async (
  inventory,
  quantity,
  variants,
  purchasePrice,
  salePrice,
  transaction,
) => {
  const productId = Number(inventory?.productId);
  const qty = Number(quantity || 0);

  if (!productId) {
    throw new ApiError(400, "InventoryMaster.productId missing (Products.Id)");
  }
  if (qty <= 0) throw new ApiError(400, "Invalid intransit quantity");

  const stock = await findInTransitStockByProductId(productId, transaction);
  if (!stock) throw new ApiError(404, "InTransitStock not found");

  const nextQty = Number(stock.quantity || 0) - qty;
  if (nextQty < 0) throw new ApiError(400, "InTransitStock cannot be negative");

  await stock.update(
    {
      quantity: nextQty,
      variants: subtractVariants(stock.variants, variants),
      purchase_price: Math.max(
        0,
        Number(stock.purchase_price || 0) - Number(purchasePrice || 0),
      ),
      sale_price: Math.max(
        0,
        Number(stock.sale_price || 0) - Number(salePrice || 0),
      ),
    },
    { transaction },
  );

  return stock;
};

module.exports = {
  addInTransitStock,
  subtractInTransitStock,
  findInTransitStockByProductId,
};
