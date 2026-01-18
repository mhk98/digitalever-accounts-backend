const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { uploadFile } = require("../../middlewares/upload");
const CashInOutController = require("./cashInOut.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  CashInOutController.insertIntoDB,
);
router.get("/", CashInOutController.getAllFromDB);
router.get("/all", CashInOutController.getAllFromDBWithoutQuery);
router.get("/:id", CashInOutController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  CashInOutController.deleteIdFromDB,
);
router.patch(
  "/:id",
  uploadFile,
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  CashInOutController.updateOneFromDB,
);
const CashInOutRoutes = router;
module.exports = CashInOutRoutes;
