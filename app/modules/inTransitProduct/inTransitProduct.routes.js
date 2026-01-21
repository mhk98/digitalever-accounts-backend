const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const InTransitProductController = require("./inTransitProduct.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  InTransitProductController.insertIntoDB,
);
router.get("/", InTransitProductController.getAllFromDB);
router.get("/all", InTransitProductController.getAllFromDBWithoutQuery);
router.get("/", InTransitProductController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  InTransitProductController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  InTransitProductController.updateOneFromDB,
);

const InTransitProductRoutes = router;
module.exports = InTransitProductRoutes;
