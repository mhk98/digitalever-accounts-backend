const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireAnyPermission } = require("../../middlewares/requireMenuPermission");
const { uploadFile } = require("../../middlewares/upload");
const MarketingExpenseController = require("./marketingExpense.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.getAllFromDB,
);
router.get(
  "/summary",
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.getOverviewSummaryFromDB,
);
router.get(
  "/all",
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.getDataById,
);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.MARKETER,
  ),
  requireAnyPermission(["marketing", "dm_expense"]),
  MarketingExpenseController.updateOneFromDB,
);
const MarketingExpenseRoutes = router;
module.exports = MarketingExpenseRoutes;
