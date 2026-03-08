const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const SupplierHistoryController = require("./supplierHistory.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  SupplierHistoryController.insertIntoDB,
);
router.get("/", SupplierHistoryController.getAllFromDB);
router.get("/all", SupplierHistoryController.getAllFromDBWithoutQuery);
router.get("/", SupplierHistoryController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  SupplierHistoryController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  SupplierHistoryController.updateOneFromDB,
);

const SupplierHistoryRoutes = router;
module.exports = SupplierHistoryRoutes;
