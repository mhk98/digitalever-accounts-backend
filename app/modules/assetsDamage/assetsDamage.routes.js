const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const AssetsDamageController = require("./assetsDamage.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  AssetsDamageController.insertIntoDB,
);
router.get("/", AssetsDamageController.getAllFromDB);
router.get("/all", AssetsDamageController.getAllFromDBWithoutQuery);
router.get("/:id", AssetsDamageController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  AssetsDamageController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  AssetsDamageController.updateOneFromDB,
);

const AssetsDamageRoutes = router;
module.exports = AssetsDamageRoutes;
