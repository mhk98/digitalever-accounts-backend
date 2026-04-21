const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const { uploadFile } = require("../../middlewares/upload");

const PettyCashController = require("./pettyCash.controller");
const router = require("express").Router();
const pettyCashAccess = requireAnyPermission([
  "petty_cash",
  "petty_cash_requisition",
]);

router.post(
  "/create",
  uploadFile,
  auth(),
  pettyCashAccess,
  PettyCashController.insertIntoDB,
);
router.get("/", auth(), pettyCashAccess, PettyCashController.getAllFromDB);
router.get(
  "/all",
  auth(),
  pettyCashAccess,
  PettyCashController.getAllFromDBWithoutQuery,
);
// router.get("/:id", PettyCashController.getDataById);
router.delete(
  "/:id",
  auth(),
  pettyCashAccess,
  PettyCashController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(),
  pettyCashAccess,
  PettyCashController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  pettyCashAccess,
  PettyCashController.approveRequisition,
);
const PettyCashRoutes = router;
module.exports = PettyCashRoutes;
