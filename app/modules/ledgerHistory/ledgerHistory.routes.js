const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const LedgerHistoryController = require("./ledgerHistory.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  LedgerHistoryController.insertIntoDB,
);
router.get("/", LedgerHistoryController.getAllFromDB);
router.get("/all", LedgerHistoryController.getAllFromDBWithoutQuery);
router.get("/:id", LedgerHistoryController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  LedgerHistoryController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  LedgerHistoryController.updateOneFromDB,
);

const LedgerHistoryRoutes = router;
module.exports = LedgerHistoryRoutes;
