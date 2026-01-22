const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { uploadFile } = require("../../middlewares/upload");
const ReceiveableController = require("./receiveable.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  ReceiveableController.insertIntoDB,
);
router.get("/", ReceiveableController.getAllFromDB);
router.get("/all", ReceiveableController.getAllFromDBWithoutQuery);
// router.get("/:id", ReceiveableController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  ReceiveableController.deleteIdFromDB,
);
router.patch(
  "/:id",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  ReceiveableController.updateOneFromDB,
);
const ReceiveableRoutes = router;
module.exports = ReceiveableRoutes;
