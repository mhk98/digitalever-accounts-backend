const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const EmployeeListController = require("./employeeList.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  EmployeeListController.insertIntoDB,
);
router.get("/", EmployeeListController.getAllFromDB);
router.get("/all", EmployeeListController.getAllFromDBWithoutQuery);
router.get("/:id", EmployeeListController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  EmployeeListController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  EmployeeListController.updateOneFromDB,
);

const EmployeeListRoutes = router;
module.exports = EmployeeListRoutes;
