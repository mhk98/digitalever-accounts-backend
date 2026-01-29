const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const SalaryController = require("./salary.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  SalaryController.insertIntoDB,
);
router.get("/", SalaryController.getAllFromDB);
router.get("/all", SalaryController.getAllFromDBWithoutQuery);
router.get("/:id", SalaryController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  SalaryController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  SalaryController.updateOneFromDB,
);
const SalaryRoutes = router;
module.exports = SalaryRoutes;
