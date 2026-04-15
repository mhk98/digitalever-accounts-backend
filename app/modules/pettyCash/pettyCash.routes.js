const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const { uploadFile } = require("../../middlewares/upload");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");

const PettyCashController = require("./pettyCash.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(),
  requireMenuPermission("petty_cash"),
  applyApprovalWorkflow({ modelKey: "pettyCash", entityLabel: "Petty Cash" }),
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
  auth(),
  requireMenuPermission("petty_cash"),
  applyApprovalWorkflow({ modelKey: "pettyCash", entityLabel: "Petty Cash" }),
  PettyCashController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(),
  requireMenuPermission("petty_cash"),
  applyApprovalWorkflow({ modelKey: "pettyCash", entityLabel: "Petty Cash" }),
  PettyCashController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("petty_cash"),
  approvePendingWorkflow({ modelKey: "pettyCash", entityLabel: "Petty Cash" }),
);
const PettyCashRoutes = router;
module.exports = PettyCashRoutes;
