const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const { uploadFile } = require("../../middlewares/upload");

const PettyCashController = require("./pettyCash.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("petty_cash"),
  PettyCashController.insertIntoDB,
);
router.get("/", auth(), requireMenuPermission("petty_cash"), PettyCashController.getAllFromDB);
router.get(
  "/all",
  auth(),
  requireMenuPermission("petty_cash"),
  PettyCashController.getAllFromDBWithoutQuery,
);
// router.get("/:id", PettyCashController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("petty_cash"),
  PettyCashController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("petty_cash"),
  PettyCashController.updateOneFromDB,
);
const PettyCashRoutes = router;
module.exports = PettyCashRoutes;
