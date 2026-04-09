const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const ManufactureController = require("./manufacture.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  requireMenuPermission("manufacture_menu"),
  ManufactureController.insertIntoDB,
);
router.get("/", auth(), requireMenuPermission("manufacture_menu"), ManufactureController.getAllFromDB);
router.get(
  "/all",
  auth(),
  requireMenuPermission("manufacture_menu"),
  ManufactureController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), requireMenuPermission("manufacture_menu"), ManufactureController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  requireMenuPermission("manufacture_menu"),
  ManufactureController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  requireMenuPermission("manufacture_menu"),
  ManufactureController.updateOneFromDB,
);

const ManufactureRoutes = router;
module.exports = ManufactureRoutes;
