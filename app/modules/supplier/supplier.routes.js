const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const SupplierController = require("./supplier.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  SupplierController.insertIntoDB,
);
router.get("/", SupplierController.getAllFromDB);
router.get("/all", SupplierController.getAllFromDBWithoutQuery);
router.get("/:id", SupplierController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  SupplierController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  SupplierController.updateOneFromDB,
);
const SupplierRoutes = router;
module.exports = SupplierRoutes;
