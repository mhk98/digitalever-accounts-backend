const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const EmployeeController = require("./employee.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  EmployeeController.insertIntoDB,
);
router.get("/", EmployeeController.getAllFromDB);
router.get("/all", EmployeeController.getAllFromDBWithoutQuery);
router.get("/", EmployeeController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  EmployeeController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  EmployeeController.updateOneFromDB,
);

const EmployeeRoutes = router;
module.exports = EmployeeRoutes;
