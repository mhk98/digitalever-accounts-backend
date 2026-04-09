const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const SalaryController = require("./salary.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("payroll"),
  SalaryController.insertIntoDB,
);
router.get("/", auth(), requireMenuPermission("payroll"), SalaryController.getAllFromDB);
router.get("/all", auth(), requireMenuPermission("payroll"), SalaryController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), requireMenuPermission("payroll"), SalaryController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("payroll"),
  SalaryController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("payroll"),
  SalaryController.updateOneFromDB,
);
const SalaryRoutes = router;
module.exports = SalaryRoutes;
