const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const StockAdjustmentController = require("./stockAdjustment.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  StockAdjustmentController.insertIntoDB,
);
router.get("/", StockAdjustmentController.getAllFromDB);
router.get("/all", StockAdjustmentController.getAllFromDBWithoutQuery);
router.get("/:id", StockAdjustmentController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  StockAdjustmentController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  StockAdjustmentController.updateOneFromDB,
);

const StockAdjustmentRoutes = router;
module.exports = StockAdjustmentRoutes;
