const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { uploadFile } = require("../../middlewares/upload");
const MarketingExpenseController = require("./marketingExpense.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  MarketingExpenseController.insertIntoDB,
);
router.get("/", MarketingExpenseController.getAllFromDB);
router.get("/all", MarketingExpenseController.getAllFromDBWithoutQuery);
router.get("/:id", MarketingExpenseController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  MarketingExpenseController.deleteIdFromDB,
);
router.patch(
  "/:id",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  MarketingExpenseController.updateOneFromDB,
);
const MarketingExpenseRoutes = router;
module.exports = MarketingExpenseRoutes;
