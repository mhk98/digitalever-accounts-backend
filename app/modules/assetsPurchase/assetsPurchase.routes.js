const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const AssetsPurchaseController = require("./assetsPurchase.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  AssetsPurchaseController.insertIntoDB,
);
router.get("/", AssetsPurchaseController.getAllFromDB);
router.get("/all", AssetsPurchaseController.getAllFromDBWithoutQuery);
router.get("/:id", AssetsPurchaseController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  AssetsPurchaseController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  AssetsPurchaseController.updateOneFromDB,
);

const AssetsPurchaseRoutes = router;
module.exports = AssetsPurchaseRoutes;
