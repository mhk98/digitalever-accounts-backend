const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const ItemController = require("./item.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  ItemController.insertIntoDB,
);
router.get("/", ItemController.getAllFromDB);
router.get("/all", ItemController.getAllFromDBWithoutQuery);
router.get("/", ItemController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  ItemController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  ItemController.updateOneFromDB,
);

const ItemRoutes = router;
module.exports = ItemRoutes;
