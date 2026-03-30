const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const ProfileLossController = require("./profileLoss.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  ProfileLossController.insertIntoDB,
);
router.get("/", ProfileLossController.getAllFromDB);
router.get("/all", ProfileLossController.getAllFromDBWithoutQuery);
router.get("/:id", ProfileLossController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  ProfileLossController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  ProfileLossController.updateOneFromDB,
);

const ProfileLossRoutes = router;
module.exports = ProfileLossRoutes;
