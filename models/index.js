/* eslint-disable @typescript-eslint/no-var-requires */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require("../db/db");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DataTypes } = require("sequelize");

// =====================
// Define models
// =====================
db.user = require("../app/modules/user/user.model")(db.sequelize, DataTypes);

db.product = require("../app/modules/product/product.model")(
  db.sequelize,
  DataTypes,
);
db.variation = require("../app/modules/variation/variation.model")(
  db.sequelize,
  DataTypes,
);
db.item = require("../app/modules/item/item.model")(db.sequelize, DataTypes);
db.itemMaster = require("../app/modules/itemMaster/itemMaster.model")(
  db.sequelize,
  DataTypes,
);
db.manufacture = require("../app/modules/manufacture/manufacture.model")(
  db.sequelize,
  DataTypes,
);
db.stockAdjustment =
  require("../app/modules/stockAdjustment/stockAdjustment.model")(
    db.sequelize,
    DataTypes,
  );
db.mixer = require("../app/modules/mixer/mixer.model")(db.sequelize, DataTypes);

db.receivedProduct =
  require("../app/modules/receivedProduct/receivedProduct.model")(
    db.sequelize,
    DataTypes,
  );
db.inventoryMaster =
  require("../app/modules/inventoryMaster/inventoryMaster.model")(
    db.sequelize,
    DataTypes,
  );

db.inTransitProduct =
  require("../app/modules/inTransitProduct/inTransitProduct.model")(
    db.sequelize,
    DataTypes,
  );

db.returnProduct = require("../app/modules/returnProduct/returnProduct.model")(
  db.sequelize,
  DataTypes,
);

db.purchaseReturnProduct =
  require("../app/modules/purchaseReturnProduct/purchaseReturnProduct.model")(
    db.sequelize,
    DataTypes,
  );

db.confirmOrder = require("../app/modules/confirmOrder/confirmOrder.model")(
  db.sequelize,
  DataTypes,
);

db.warrantyProduct =
  require("../app/modules/warrantyProduct/warrantyProduct.model")(
    db.sequelize,
    DataTypes,
  );

db.damageProduct = require("../app/modules/damageProduct/damageProduct.model")(
  db.sequelize,
  DataTypes,
);
db.damageStock = require("../app/modules/damageStock/damageStock.model")(
  db.sequelize,
  DataTypes,
);

db.damageReparingStock =
  require("../app/modules/damageReparingStock/damageReparingStock.model")(
    db.sequelize,
    DataTypes,
  );

db.damageRepair = require("../app/modules/damageRepair/damageRepair.model")(
  db.sequelize,
  DataTypes,
);

db.damageRepaired =
  require("../app/modules/damageRepaired/damageRepaired.model")(
    db.sequelize,
    DataTypes,
  );

db.meta = require("../app/modules/meta/meta.model")(db.sequelize, DataTypes);

db.assetsPurchase =
  require("../app/modules/assetsPurchase/assetsPurchase.model")(
    db.sequelize,
    DataTypes,
  );

db.assetsSale = require("../app/modules/assetsSale/assetsSale.model")(
  db.sequelize,
  DataTypes,
);

db.assetsDamage = require("../app/modules/assetsDamage/assetsDamage.model")(
  db.sequelize,
  DataTypes,
);

db.cashIn = require("../app/modules/cashIn/cashIn.model")(
  db.sequelize,
  DataTypes,
);

db.pettyCash = require("../app/modules/pettyCash/pettyCash.model")(
  db.sequelize,
  DataTypes,
);
db.ledger = require("../app/modules/ledger/ledger.model")(
  db.sequelize,
  DataTypes,
);
db.ledgerHistory = require("../app/modules/ledgerHistory/ledgerHistory.model")(
  db.sequelize,
  DataTypes,
);

db.expense = require("../app/modules/expense/expense.model")(
  db.sequelize,
  DataTypes,
);

db.book = require("../app/modules/book/book.model")(db.sequelize, DataTypes);

db.profileLoss = require("../app/modules/profileLoss/profileLoss.model")(
  db.sequelize,
  DataTypes,
);

db.marketingBook = require("../app/modules/marketingBook/marketingBook.model")(
  db.sequelize,
  DataTypes,
);
db.marketingExpense =
  require("../app/modules/marketingExpense/marketingExpense.model")(
    db.sequelize,
    DataTypes,
  );

db.category = require("../app/modules/category/category.model")(
  db.sequelize,
  DataTypes,
);

db.supplier = require("../app/modules/supplier/supplier.model")(
  db.sequelize,
  DataTypes,
);

db.supplierHistory =
  require("../app/modules/supplierHistory/supplierHistory.model")(
    db.sequelize,
    DataTypes,
  );

db.warehouse = require("../app/modules/warehouse/warehouse.model")(
  db.sequelize,
  DataTypes,
);

db.cashInOut = require("../app/modules/cashInOut/cashInOut.model")(
  db.sequelize,
  DataTypes,
);

db.receiveable = require("../app/modules/receiveable/receiveable.model")(
  db.sequelize,
  DataTypes,
);

db.payable = require("../app/modules/payable/payable.model")(
  db.sequelize,
  DataTypes,
);

db.employee = require("../app/modules/employee/employee.model")(
  db.sequelize,
  DataTypes,
);

db.employeeList = require("../app/modules/employeeList/employeeList.model")(
  db.sequelize,
  DataTypes,
);

db.notification = require("../app/modules/notification/notification.model")(
  db.sequelize,
  DataTypes,
);

db.salary = require("../app/modules/salary/salary.model")(
  db.sequelize,
  DataTypes,
);

db.logo = require("../app/modules/logo/logo.model")(db.sequelize, DataTypes);

db.purchaseRequisition =
  require("../app/modules/purchaseRequision/purchaseRequisition.model")(
    db.sequelize,
    DataTypes,
  );

db.assetsRequisition =
  require("../app/modules/assetsRequisition/assetsRequisition.model")(
    db.sequelize,
    DataTypes,
  );

db.posReport = require("../app/modules/posReport/posReport.model")(
  db.sequelize,
  DataTypes,
);

// =====================
// Associations
// লক্ষ্য: সব জায়গায় include এ as: "supplier" এবং as: "warehouse" কাজ করবে
// নিয়ম:
// 1) CHILD model এ belongsTo(..., { as: "supplier"/"warehouse" }) থাকবে
// 2) Parent side (Supplier/Warehouse hasMany) এ as দিবেন না (alias duplicate error হয়)
// =====================

//Variation relation with product
// db.product.hasMany(db.variation, { foreignKey: "productId" });
// db.variation.belongsTo(db.product, {
//   foreignKey: "productId",
//   as: "product",
// });

db.product.hasMany(db.variation, {
  foreignKey: "productId",
  as: "variations",
});

db.variation.belongsTo(db.product, {
  foreignKey: "productId",
  as: "product",
});
// ---- base product relations

db.supplier.hasMany(db.supplierHistory, { foreignKey: "supplierId" });
db.supplierHistory.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

db.book.hasMany(db.supplierHistory, { foreignKey: "bookId" });
db.supplierHistory.belongsTo(db.book, { foreignKey: "bookId", as: "book" });

db.item.hasMany(db.manufacture, { foreignKey: "itemId" });
db.manufacture.belongsTo(db.item, { foreignKey: "itemId" });

db.product.hasMany(db.manufacture, { foreignKey: "productId" });
db.manufacture.belongsTo(db.product, { foreignKey: "productId" });

db.supplier.hasMany(db.manufacture, { foreignKey: "supplierId" });
db.manufacture.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});
db.supplier.hasMany(db.stockAdjustment, { foreignKey: "supplierId" });
db.stockAdjustment.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// db.item.hasMany(db.mixer, { foreignKey: "itemId" });
// db.mixer.belongsTo(db.item, { foreignKey: "itemId", as: "item" });

db.product.hasMany(db.mixer, { foreignKey: "productId" });
db.mixer.belongsTo(db.product, { foreignKey: "productId", as: "product" });

db.item.hasMany(db.itemMaster, { foreignKey: "itemId" });
db.itemMaster.belongsTo(db.item, { foreignKey: "itemId" });

db.product.hasMany(db.itemMaster, { foreignKey: "productId" });
db.itemMaster.belongsTo(db.product, { foreignKey: "productId" });

db.product.hasMany(db.receivedProduct, { foreignKey: "productId" });
db.receivedProduct.belongsTo(db.product, { foreignKey: "productId" });

db.product.hasMany(db.inventoryMaster, { foreignKey: "productId" });
db.inventoryMaster.belongsTo(db.product, { foreignKey: "productId" });

// db.supplier.hasMany(db.inventoryMaster, { foreignKey: "supplierId" });
// db.inventoryMaster.belongsTo(db.supplier, { foreignKey: "supplierId" });

// db.warehouse.hasMany(db.inventoryMaster, { foreignKey: "warehousId" });
// db.inventoryMaster.belongsTo(db.warehouse, { foreignKey: "warehousId" });

db.inventoryMaster.hasMany(db.returnProduct, { foreignKey: "productId" });
db.returnProduct.belongsTo(db.inventoryMaster, { foreignKey: "productId" });

db.inventoryMaster.hasMany(db.inTransitProduct, { foreignKey: "productId" });
db.inTransitProduct.belongsTo(db.inventoryMaster, { foreignKey: "productId" });

db.inventoryMaster.hasMany(db.damageProduct, { foreignKey: "productId" });
db.damageProduct.belongsTo(db.inventoryMaster, { foreignKey: "productId" });

db.product.hasMany(db.damageStock, { foreignKey: "productId" });
db.damageStock.belongsTo(db.product, { foreignKey: "productId" });

db.damageStock.hasMany(db.damageRepair, { foreignKey: "productId" });
db.damageRepair.belongsTo(db.damageStock, { foreignKey: "productId" });

db.product.hasMany(db.damageReparingStock, { foreignKey: "productId" });
db.damageReparingStock.belongsTo(db.product, { foreignKey: "productId" });

db.damageReparingStock.hasMany(db.damageRepaired, { foreignKey: "productId" });
db.damageRepaired.belongsTo(db.damageReparingStock, {
  foreignKey: "productId",
});

// db.damageStock.hasMany(db.damageRepaired, { foreignKey: "productId" });
// db.damageRepaired.belongsTo(db.damageStock, { foreignKey: "productId" });

db.inventoryMaster.hasMany(db.purchaseReturnProduct, {
  foreignKey: "productId",
});
// NOTE: আপনার আগের মতোই রেখেছি (যদি ভুল হয়, receivedProduct/ product কোনটা হবে সেটা আপনার ডাটা কাঠামো অনুযায়ী ঠিক করবেন)
db.purchaseReturnProduct.belongsTo(db.inventoryMaster, {
  foreignKey: "productId",
});

// db.product.hasMany(db.confirmOrder, { foreignKey: "productId" });
// db.confirmOrder.belongsTo(db.product, { foreignKey: "productId" });

db.confirmOrder.belongsTo(db.product, {
  foreignKey: "productId",
  as: "product",
});
db.product.hasMany(db.confirmOrder, {
  foreignKey: "productId",
  as: "confirmOrders",
});

db.book.hasMany(db.cashInOut, { foreignKey: "bookId" });
db.cashInOut.belongsTo(db.book, { foreignKey: "bookId" });

db.supplier.hasMany(db.ledger, { foreignKey: "supplierId" });
db.ledger.belongsTo(db.supplier, { foreignKey: "supplierId", as: "supplier" });

db.employeeList.hasMany(db.ledger, { foreignKey: "employeeId" });
db.ledger.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.ledger.hasMany(db.ledgerHistory, { foreignKey: "ledgerId" });
db.ledgerHistory.belongsTo(db.ledger, { foreignKey: "ledgerId", as: "ledger" });

db.supplier.hasMany(db.ledgerHistory, { foreignKey: "supplierId" });
db.ledgerHistory.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

db.employeeList.hasMany(db.ledgerHistory, { foreignKey: "employeeId" });
db.ledgerHistory.belongsTo(db.employeeList, {
  foreignKey: "employeeId",
  as: "employee",
});

db.supplier.hasMany(db.cashInOut, { foreignKey: "supplierId" });
db.cashInOut.belongsTo(db.supplier, { foreignKey: "supplierId" });

db.marketingBook.hasMany(db.marketingExpense, { foreignKey: "bookId" });
db.marketingExpense.belongsTo(db.marketingBook, { foreignKey: "bookId" });

// =====================
// Standard Supplier + Warehouse relations
// =====================

// ---- PurchaseRequisition
db.warehouse.hasMany(db.purchaseRequisition, { foreignKey: "warehouseId" });
db.purchaseRequisition.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.purchaseRequisition, { foreignKey: "supplierId" });
db.purchaseRequisition.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- ReceivedProduct
db.warehouse.hasMany(db.receivedProduct, { foreignKey: "warehouseId" });
db.receivedProduct.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.receivedProduct, { foreignKey: "supplierId" });
db.receivedProduct.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- PurchaseReturnProduct
db.warehouse.hasMany(db.purchaseReturnProduct, { foreignKey: "warehouseId" });
db.purchaseReturnProduct.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.purchaseReturnProduct, { foreignKey: "supplierId" });
db.purchaseReturnProduct.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- InTransitProduct
db.warehouse.hasMany(db.inTransitProduct, { foreignKey: "warehouseId" });
db.inTransitProduct.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.inTransitProduct, { foreignKey: "supplierId" });
db.inTransitProduct.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- ReturnProduct
db.warehouse.hasMany(db.returnProduct, { foreignKey: "warehouseId" });
db.returnProduct.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.returnProduct, { foreignKey: "supplierId" });
db.returnProduct.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- ConfirmOrder
db.warehouse.hasMany(db.confirmOrder, { foreignKey: "warehouseId" });
db.confirmOrder.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.confirmOrder, { foreignKey: "supplierId" });
db.confirmOrder.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- DamageProduct
db.warehouse.hasMany(db.damageProduct, { foreignKey: "warehouseId" });
db.damageProduct.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.damageProduct, { foreignKey: "supplierId" });
db.damageProduct.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- DamageRepair
db.warehouse.hasMany(db.damageRepair, { foreignKey: "warehouseId" });
db.damageRepair.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.damageRepair, { foreignKey: "supplierId" });
db.damageRepair.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// ---- DamageRepaired
db.warehouse.hasMany(db.damageRepaired, { foreignKey: "warehouseId" });
db.damageRepaired.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.damageRepaired, { foreignKey: "supplierId" });
db.damageRepaired.belongsTo(db.supplier, {
  foreignKey: "supplierId",
  as: "supplier",
});

// =====================
// Assets relations
// =====================
db.assetsPurchase.hasMany(db.assetsSale, { foreignKey: "productId" });
db.assetsSale.belongsTo(db.assetsPurchase, { foreignKey: "productId" });

db.assetsPurchase.hasMany(db.assetsDamage, { foreignKey: "productId" });
db.assetsDamage.belongsTo(db.assetsPurchase, { foreignKey: "productId" });

// Payable relations
db.supplier.hasMany(db.payable, { foreignKey: "supplierId" });
db.payable.belongsTo(db.supplier, { foreignKey: "supplierId", as: "supplier" });

// =====================
// Sync
// NOTE: production এ force:true দিবেন না
// =====================
db.sequelize
  .sync({ force: false })
  .then(() => console.log("Connection re-synced successfully"))
  .catch((err) => console.error("Error on re-sync:", err));

module.exports = db;
