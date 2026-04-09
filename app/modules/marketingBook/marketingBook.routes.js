const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const MarketingBookController = require("./marketingBook.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireMenuPermission("marketing"),
  MarketingBookController.insertIntoDB,
);
router.get("/", auth(), requireMenuPermission("marketing"), MarketingBookController.getAllFromDB);
router.get(
  "/all",
  auth(),
  requireMenuPermission("marketing"),
  MarketingBookController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), requireMenuPermission("marketing"), MarketingBookController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("marketing"),
  MarketingBookController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireMenuPermission("marketing"),
  MarketingBookController.updateOneFromDB,
);
const MarketingBookRoutes = router;
module.exports = MarketingBookRoutes;
