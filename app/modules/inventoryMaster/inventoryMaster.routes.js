const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const InventoryMasterController = require("./inventoryMaster.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  InventoryMasterController.insertIntoDB,
);
router.get("/", InventoryMasterController.getAllFromDB);
router.get("/all", InventoryMasterController.getAllFromDBWithoutQuery);
router.get("/", InventoryMasterController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  InventoryMasterController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  InventoryMasterController.updateOneFromDB,
);

const InventoryMasterRoutes = router;
module.exports = InventoryMasterRoutes;
