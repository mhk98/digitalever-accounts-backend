const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const LedgerHistoryController = require("./ledgerHistory.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  LedgerHistoryController.insertIntoDB,
);
router.get("/", auth(), LedgerHistoryController.getAllFromDB);
router.get("/all", auth(), LedgerHistoryController.getAllFromDBWithoutQuery);
router.get("/:id", auth(), LedgerHistoryController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  LedgerHistoryController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  LedgerHistoryController.updateOneFromDB,
);

const LedgerHistoryRoutes = router;
module.exports = LedgerHistoryRoutes;
