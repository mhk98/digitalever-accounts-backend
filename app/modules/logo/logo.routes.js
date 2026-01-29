const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { uploadSingle, uploadFile } = require("../../middlewares/upload");
const LogoController = require("./logo.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  LogoController.insertIntoDB,
);
router.get("/", LogoController.getAllFromDB);
router.get("/all", LogoController.getAllFromDBWithoutQuery);
router.get("/:id", LogoController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  LogoController.deleteIdFromDB,
);
router.patch(
  "/:id",
  uploadFile,
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  LogoController.updateOneFromDB,
);
const LogoRoutes = router;
module.exports = LogoRoutes;
