const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const EmployeeListController = require("./employeeList.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("employee_list"),
  EmployeeListController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("employee_list"),
  EmployeeListController.getAllFromDB,
);
router.get(
  "/all",
  // auth(),
  // requireMenuPermission("employee_list"),
  EmployeeListController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("employee_list"),
  EmployeeListController.getDataById,
);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("employee_list"),
  EmployeeListController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("employee_list"),
  EmployeeListController.updateOneFromDB,
);

const EmployeeListRoutes = router;
module.exports = EmployeeListRoutes;
