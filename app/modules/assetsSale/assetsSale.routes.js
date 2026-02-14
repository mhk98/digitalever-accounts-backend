const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const AssetsSaleController = require("./assetsSale.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  AssetsSaleController.insertIntoDB,
);
router.get("/", AssetsSaleController.getAllFromDB);
router.get("/all", AssetsSaleController.getAllFromDBWithoutQuery);
router.get("/:id", AssetsSaleController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  AssetsSaleController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  AssetsSaleController.updateOneFromDB,
);

const AssetsSaleRoutes = router;
module.exports = AssetsSaleRoutes;
