const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const WarehouseController = require("./warehouse.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  WarehouseController.insertIntoDB,
);
router.get("/", WarehouseController.getAllFromDB);
router.get("/all", WarehouseController.getAllFromDBWithoutQuery);
router.get("/:id", WarehouseController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  WarehouseController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  WarehouseController.updateOneFromDB,
);
const WarehouseRoutes = router;
module.exports = WarehouseRoutes;
