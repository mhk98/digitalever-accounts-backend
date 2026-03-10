const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const ManufactureController = require("./manufacture.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  ManufactureController.insertIntoDB,
);
router.get("/", ManufactureController.getAllFromDB);
router.get("/all", ManufactureController.getAllFromDBWithoutQuery);
router.get("/:id", ManufactureController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  ManufactureController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  ManufactureController.updateOneFromDB,
);

const ManufactureRoutes = router;
module.exports = ManufactureRoutes;
