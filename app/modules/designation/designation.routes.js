const router = require("express").Router();
const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const DesignationController = require("./designation.controller");

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT),
  requireMenuPermission("department_designation"),
  DesignationController.insertIntoDB,
);
router.get(
  "/",
  auth(),
  requireMenuPermission("department_designation"),
  DesignationController.getAllFromDB,
);
router.get(
  "/all",
  auth(),
  requireMenuPermission("department_designation"),
  DesignationController.getAllFromDBWithoutQuery,
);
router.get(
  "/:id",
  auth(),
  requireMenuPermission("department_designation"),
  DesignationController.getDataById,
);
router.put(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT),
  requireMenuPermission("department_designation"),
  DesignationController.updateOneFromDB,
);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("department_designation"),
  DesignationController.deleteIdFromDB,
);

module.exports = router;
