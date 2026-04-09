const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const LedgerController = require("./ledger.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("credit_ledger"),
  LedgerController.insertIntoDB,
);
router.get("/", auth(), requireMenuPermission("credit_ledger"), LedgerController.getAllFromDB);
router.get(
  "/all",
  auth(),
  requireMenuPermission("credit_ledger"),
  LedgerController.getAllFromDBWithoutQuery,
);
router.get("/:id", auth(), requireMenuPermission("credit_ledger"), LedgerController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("credit_ledger"),
  LedgerController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.ACCOUNTANT,
  ),
  requireMenuPermission("credit_ledger"),
  LedgerController.updateOneFromDB,
);

const LedgerRoutes = router;
module.exports = LedgerRoutes;
