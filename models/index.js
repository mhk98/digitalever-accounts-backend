// // eslint-disable-next-line @typescript-eslint/no-var-requires
// const db = require("../db/db");
// // eslint-disable-next-line @typescript-eslint/no-var-requires
// const { DataTypes } = require("sequelize");

// // Define models
// db.user = require("../app/modules/user/user.model")(db.sequelize, DataTypes);
// db.product = require("../app/modules/product/product.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.receivedProduct =
//   require("../app/modules/receivedProduct/receivedProduct.model")(
//     db.sequelize,
//     DataTypes,
//   );
// db.inTransitProduct =
//   require("../app/modules/inTransitProduct/inTransitProduct.model")(
//     db.sequelize,
//     DataTypes,
//   );
// db.returnProduct = require("../app/modules/returnProduct/returnProduct.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.purchaseReturnProduct =
//   require("../app/modules/purchaseReturnProduct/purchaseReturnProduct.model")(
//     db.sequelize,
//     DataTypes,
//   );
// db.confirmOrder = require("../app/modules/confirmOrder/confirmOrder.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.warrantyProduct =
//   require("../app/modules/warrantyProduct/warrantyProduct.model")(
//     db.sequelize,
//     DataTypes,
//   );
// db.damageProduct = require("../app/modules/damageProduct/damageProduct.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.damageRepair = require("../app/modules/damageRepair/damageRepair.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.damageRepaired =
//   require("../app/modules/damageRepaired/damageRepaired.model")(
//     db.sequelize,
//     DataTypes,
//   );
// db.meta = require("../app/modules/meta/meta.model")(db.sequelize, DataTypes);
// db.assetsPurchase =
//   require("../app/modules/assetsPurchase/assetsPurchase.model")(
//     db.sequelize,
//     DataTypes,
//   );
// db.assetsSale = require("../app/modules/assetsSale/assetsSale.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.assetsDamage = require("../app/modules/assetsDamage/assetsDamage.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.cashIn = require("../app/modules/cashIn/cashIn.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.pettyCash = require("../app/modules/pettyCash/pettyCash.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.expense = require("../app/modules/expense/expense.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.book = require("../app/modules/book/book.model")(db.sequelize, DataTypes);
// db.category = require("../app/modules/category/category.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.supplier = require("../app/modules/supplier/supplier.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.warehouse = require("../app/modules/warehouse/warehouse.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.cashInOut = require("../app/modules/cashInOut/cashInOut.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.receiveable = require("../app/modules/receiveable/receiveable.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.payable = require("../app/modules/payable/payable.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.employee = require("../app/modules/employee/employee.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.notification = require("../app/modules/notification/notification.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.salary = require("../app/modules/salary/salary.model")(
//   db.sequelize,
//   DataTypes,
// );
// db.logo = require("../app/modules/logo/logo.model")(db.sequelize, DataTypes);
// db.purchaseRequisition =
//   require("../app/modules/purchaseRequision/purchaseRequisition.model")(
//     db.sequelize,
//     DataTypes,
//   );
// db.assetsRequisition =
//   require("../app/modules/assetsRequisition/assetsRequisition.model")(
//     db.sequelize,
//     DataTypes,
//   );
// db.posReport = require("../app/modules/posReport/posReport.model")(
//   db.sequelize,
//   DataTypes,
// );

// // // Define associations
// // db.purchase.hasOne(db.accounting, { foreignKey: "purchaseId" });
// // db.accounting.belongsTo(db.purchase, { foreignKey: "purchaseId" });

// // db.sale.hasOne(db.accounting, { foreignKey: "saleId" });
// // db.accounting.belongsTo(db.sale, { foreignKey: "saleId" });

// db.product.hasMany(db.receivedProduct, { foreignKey: "productId" });
// db.receivedProduct.belongsTo(db.product, { foreignKey: "productId" });

// db.receivedProduct.hasMany(db.returnProduct, { foreignKey: "productId" });
// db.returnProduct.belongsTo(db.receivedProduct, { foreignKey: "productId" });

// db.receivedProduct.hasMany(db.inTransitProduct, { foreignKey: "productId" });
// db.inTransitProduct.belongsTo(db.receivedProduct, { foreignKey: "productId" });

// db.receivedProduct.hasMany(db.damageProduct, { foreignKey: "productId" });
// db.damageProduct.belongsTo(db.receivedProduct, { foreignKey: "productId" });

// db.damageProduct.hasMany(db.damageRepair, { foreignKey: "productId" });
// db.damageRepair.belongsTo(db.damageProduct, { foreignKey: "productId" });

// db.damageRepair.hasMany(db.damageRepaired, { foreignKey: "productId" });
// db.damageRepaired.belongsTo(db.damageRepair, { foreignKey: "productId" });

// db.product.hasMany(db.purchaseReturnProduct, { foreignKey: "productId" });
// db.purchaseReturnProduct.belongsTo(db.receivedProduct, {
//   foreignKey: "productId",
// });

// db.product.hasMany(db.confirmOrder, { foreignKey: "productId" });
// db.confirmOrder.belongsTo(db.product, { foreignKey: "productId" });

// db.book.hasMany(db.cashInOut, { foreignKey: "bookId" });
// db.cashInOut.belongsTo(db.book, { foreignKey: "bookId" });

// //Product relation
// db.warehouse.hasMany(db.product, {
//   foreignKey: "warehouseId",
// });
// db.product.belongsTo(db.warehouse, {
//   foreignKey: "warehouseId",
//   as: "warehouse",
// });

// db.supplier.hasMany(db.product, { foreignKey: "supplierId" });
// db.product.belongsTo(db.supplier, { foreignKey: "supplierId", as: "supplier" });

// //Purchaserequition relation
// db.warehouse.hasMany(db.purchaseRequisition, {
//   foreignKey: "warehouseId",
//   as: "warehouseRequisition",
// });
// db.purchaseRequisition.belongsTo(db.warehouse, {
//   foreignKey: "warehouseId",
//   as: "warehouse",
// });

// db.supplier.hasMany(db.purchaseRequisition, {
//   foreignKey: "supplierId",
// });
// db.purchaseRequisition.belongsTo(db.supplier, {
//   foreignKey: "supplierId",
//   as: "supplier",
// });

// //ReceivedProduct relation
// db.warehouse.hasMany(db.receivedProduct, {
//   foreignKey: "warehouseId",
//   as: "warehouseReceived",
// });
// db.receivedProduct.belongsTo(db.warehouse, {
//   foreignKey: "warehouseId",
//   as: "warehouse",
// });

// db.supplier.hasMany(db.receivedProduct, {
//   foreignKey: "supplierId",
// });
// db.receivedProduct.belongsTo(db.supplier, {
//   foreignKey: "supplierId",
//   as: "supplier",
// });

// //Purchase return product relation
// db.warehouse.hasMany(db.purchaseReturnProduct, {
//   foreignKey: "warehouseId",
//   as: "warehousePurchaseReturn",
// });
// db.purchaseReturnProduct.belongsTo(db.warehouse, {
//   foreignKey: "warehouseId",
//   as: "warehouse",
// });

// db.supplier.hasMany(db.purchaseReturnProduct, {
//   foreignKey: "supplierId",
// });
// db.purchaseReturnProduct.belongsTo(db.supplier, {
//   foreignKey: "supplierId",
// });

// //Intransit return product relation
// db.warehouse.hasMany(db.inTransitProduct, {
//   foreignKey: "warehouseId",
//   as: "warehouseIntransit",
// });
// db.inTransitProduct.belongsTo(db.warehouse, {
//   foreignKey: "warehouseId",
//   as: "warehouse",
// });

// db.supplier.hasMany(db.inTransitProduct, {
//   foreignKey: "supplierId",
// });
// db.inTransitProduct.belongsTo(db.supplier, {
//   foreignKey: "supplierId",
//   as: "supplier",
// });

// //Sales return product relation
// db.warehouse.hasMany(db.returnProduct, {
//   foreignKey: "warehouseId",
//   as: "warehouseSalesReturn",
// });
// db.returnProduct.belongsTo(db.warehouse, {
//   foreignKey: "warehouseId",
//   as: "warehouse",
// });

// db.supplier.hasMany(db.returnProduct, {
//   foreignKey: "supplierId",
// });
// db.returnProduct.belongsTo(db.supplier, {
//   foreignKey: "supplierId",
//   as: "supplier",
// });

// //Confirm order product relation
// db.warehouse.hasMany(db.confirmOrder, {
//   foreignKey: "warehouseId",
//   as: "warehouseConfirmOrder",
// });
// db.confirmOrder.belongsTo(db.warehouse, {
//   foreignKey: "warehouseId",
//   as: "warehouse",
// });

// db.supplier.hasMany(db.confirmOrder, {
//   foreignKey: "supplierId",
// });
// db.confirmOrder.belongsTo(db.supplier, {
//   foreignKey: "supplierId",
//   as: "supplier",
// });

// //Damage product relation
// db.warehouse.hasMany(db.damageProduct, {
//   foreignKey: "warehouseId",
//   as: "warehouseDamageProduct",
// });
// db.damageProduct.belongsTo(db.warehouse, {
//   foreignKey: "warehouseId",
//   as: "warehouse",
// });

// db.supplier.hasMany(db.damageProduct, {
//   foreignKey: "supplierId",
// });
// db.damageProduct.belongsTo(db.supplier, {
//   foreignKey: "supplierId",
//   as: "supplier",
// });

// //Damage repairing
// db.warehouse.hasMany(db.damageRepair, {
//   foreignKey: "warehouseId",
//   as: "warehouseDamageRepair",
// });
// db.damageRepair.belongsTo(db.warehouse, {
//   foreignKey: "warehouseId",
//   as: "warehouse",
// });

// db.supplier.hasMany(db.damageRepair, {
//   foreignKey: "supplierId",
// });
// db.damageRepair.belongsTo(db.supplier, {
//   foreignKey: "supplierId",
//   as: "supplier",
// });

// //Damage repaired
// db.warehouse.hasMany(db.damageRepaired, {
//   foreignKey: "warehouseId",
//   as: "warehouseDamageRepaired",
// });
// db.damageRepaired.belongsTo(db.warehouse, {
//   foreignKey: "warehouseId",
//   as: "warehouse",
// });

// db.supplier.hasMany(db.damageRepaired, {
//   foreignKey: "supplierId",
// });
// db.damageRepaired.belongsTo(db.supplier, {
//   foreignKey: "supplierId",
//   as: "supplier",
// });

// // db.category.hasMany(db.cashInOut, { foreignKey: "categoryId" });
// // db.cashInOut.belongsTo(db.category, { foreignKey: "categoryId" });

// // db.product.hasMany(db.sale, { foreignKey: "productId" });
// // db.sale.belongsTo(db.product, { foreignKey: "productId" });

// db.assetsPurchase.hasMany(db.assetsSale, { foreignKey: "productId" });
// db.assetsSale.belongsTo(db.assetsPurchase, { foreignKey: "productId" });

// db.assetsPurchase.hasMany(db.assetsDamage, { foreignKey: "productId" });
// db.assetsDamage.belongsTo(db.assetsPurchase, { foreignKey: "productId" });

// // Sync the database
// db.sequelize
//   .sync({ force: true })
//   .then(() => {
//     console.log("Connection re-synced successfully");
//   })
//   .catch((err) => {
//     console.error("Error on re-sync:", err);
//   });

// module.exports = db;

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

db.receivedProduct =
  require("../app/modules/receivedProduct/receivedProduct.model")(
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

db.expense = require("../app/modules/expense/expense.model")(
  db.sequelize,
  DataTypes,
);

db.book = require("../app/modules/book/book.model")(db.sequelize, DataTypes);

db.category = require("../app/modules/category/category.model")(
  db.sequelize,
  DataTypes,
);

db.supplier = require("../app/modules/supplier/supplier.model")(
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

// ---- base product relations
db.product.hasMany(db.receivedProduct, { foreignKey: "productId" });
db.receivedProduct.belongsTo(db.product, { foreignKey: "productId" });

db.receivedProduct.hasMany(db.returnProduct, { foreignKey: "productId" });
db.returnProduct.belongsTo(db.receivedProduct, { foreignKey: "productId" });

db.receivedProduct.hasMany(db.inTransitProduct, { foreignKey: "productId" });
db.inTransitProduct.belongsTo(db.receivedProduct, { foreignKey: "productId" });

db.receivedProduct.hasMany(db.damageProduct, { foreignKey: "productId" });
db.damageProduct.belongsTo(db.receivedProduct, { foreignKey: "productId" });

db.damageProduct.hasMany(db.damageRepair, { foreignKey: "productId" });
db.damageRepair.belongsTo(db.damageProduct, { foreignKey: "productId" });

db.damageRepair.hasMany(db.damageRepaired, { foreignKey: "productId" });
db.damageRepaired.belongsTo(db.damageRepair, { foreignKey: "productId" });

db.product.hasMany(db.purchaseReturnProduct, { foreignKey: "productId" });
// NOTE: আপনার আগের মতোই রেখেছি (যদি ভুল হয়, receivedProduct/ product কোনটা হবে সেটা আপনার ডাটা কাঠামো অনুযায়ী ঠিক করবেন)
db.purchaseReturnProduct.belongsTo(db.receivedProduct, {
  foreignKey: "productId",
});

db.product.hasMany(db.confirmOrder, { foreignKey: "productId" });
db.confirmOrder.belongsTo(db.product, { foreignKey: "productId" });

db.book.hasMany(db.cashInOut, { foreignKey: "bookId" });
db.cashInOut.belongsTo(db.book, { foreignKey: "bookId" });

// =====================
// Standard Supplier + Warehouse relations
// =====================

// ---- Product
db.warehouse.hasMany(db.product, { foreignKey: "warehouseId" });
db.product.belongsTo(db.warehouse, {
  foreignKey: "warehouseId",
  as: "warehouse",
});

db.supplier.hasMany(db.product, { foreignKey: "supplierId" });
db.product.belongsTo(db.supplier, { foreignKey: "supplierId", as: "supplier" });

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

// =====================
// Sync
// NOTE: production এ force:true দিবেন না
// =====================
db.sequelize
  .sync({ force: false })
  .then(() => console.log("Connection re-synced successfully"))
  .catch((err) => console.error("Error on re-sync:", err));

module.exports = db;
