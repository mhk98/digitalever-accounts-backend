const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const InTransitStockController = require("./inTransitStock.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  InTransitStockController.insertIntoDB,
);
router.get("/", auth(), InTransitStockController.getAllFromDB);
router.get("/all", auth(), InTransitStockController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), InTransitStockController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  InTransitStockController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  InTransitStockController.updateOneFromDB,
);

const InTransitStockRoutes = router;
module.exports = InTransitStockRoutes;
