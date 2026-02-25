const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const MarketingBookController = require("./marketingBook.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  MarketingBookController.insertIntoDB,
);
router.get("/", MarketingBookController.getAllFromDB);
router.get("/all", MarketingBookController.getAllFromDBWithoutQuery);
router.get("/:id", MarketingBookController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  MarketingBookController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  MarketingBookController.updateOneFromDB,
);
const MarketingBookRoutes = router;
module.exports = MarketingBookRoutes;
