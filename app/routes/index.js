const express = require("express");
const UserRoutes = require("../modules/user/user.routes");
const ProductRoutes = require("../modules/product/product.routes");
const AssetsPurchaseRoutes = require("../modules/assetsPurchase/assetsPurchase.routes");
const ReceivedProductRoutes = require("../modules/receivedProduct/receivedProduct.routes");
const ReturnProductRoutes = require("../modules/returnProduct/returnProduct.routes");
const InTransitProductRoutes = require("../modules/inTransitProduct/inTransitProduct.routes");
const MetaRoutes = require("../modules/meta/meta.routes");
const AssetsSaleRoutes = require("../modules/assetsSale/assetsSale.routes");
const ConfirmOrderRoutes = require("../modules/confirmOrder/confirmOrder.routes");
const CashInRoutes = require("../modules/cashIn/cashIn.routes");
const PettyCashRoutes = require("../modules/pettyCash/pettyCash.routes");
const ExpenseRoutes = require("../modules/expense/expense.routes");
const BookRoutes = require("../modules/book/book.routes");
const CashInOutRoutes = require("../modules/cashInOut/cashInOut.routes");
const PurchaseReturnProductRoutes = require("../modules/purchaseReturnProduct/purchaseReturnProduct.routes");

const router = express.Router();

const moduleRoutes = [
  {
    path: "/user",
    route: UserRoutes,
  },

  {
    path: "/product",
    route: ProductRoutes,
  },
  {
    path: "/received-product",
    route: ReceivedProductRoutes,
  },

  {
    path: "/intransit-product",
    route: InTransitProductRoutes,
  },
  {
    path: "/return-product",
    route: ReturnProductRoutes,
  },
  {
    path: "/purchase-return-product",
    route: PurchaseReturnProductRoutes,
  },
  {
    path: "/confirm-order",
    route: ConfirmOrderRoutes,
  },
  {
    path: "/meta",
    route: MetaRoutes,
  },
  {
    path: "/assets-purchase",
    route: AssetsPurchaseRoutes,
  },
  {
    path: "/assets-sale",
    route: AssetsSaleRoutes,
  },
  {
    path: "/cash-in",
    route: CashInRoutes,
  },
  {
    path: "/petty-cash",
    route: PettyCashRoutes,
  },
  {
    path: "/expense",
    route: ExpenseRoutes,
  },
  {
    path: "/book",
    route: BookRoutes,
  },
  {
    path: "/book",
    route: CashInRoutes,
  },
  {
    path: "/cash-in-out",
    route: CashInOutRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));
module.exports = router;
