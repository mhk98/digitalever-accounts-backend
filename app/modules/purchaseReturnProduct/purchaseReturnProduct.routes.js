const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const PurchaseReturnProductController = require("./purchaseReturnProduct.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  PurchaseReturnProductController.insertIntoDB
);
router.get("/", PurchaseReturnProductController.getAllFromDB);
router.get("/all", PurchaseReturnProductController.getAllFromDBWithoutQuery);
router.get("/", PurchaseReturnProductController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  PurchaseReturnProductController.deleteIdFromDB
);
router.patch(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  PurchaseReturnProductController.updateOneFromDB
);

const PurchaseReturnProductRoutes = router;
module.exports = PurchaseReturnProductRoutes;
