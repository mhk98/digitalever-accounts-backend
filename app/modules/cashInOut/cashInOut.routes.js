const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { uploadFile } = require("../../middlewares/upload");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const CashInOutController = require("./cashInOut.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(),
  applyApprovalWorkflow({ modelKey: "cashInOut", entityLabel: "Cash In Out" }),
  CashInOutController.insertIntoDB,
);
router.get("/", CashInOutController.getAllFromDB);
router.get("/all", CashInOutController.getAllFromDBWithoutQuery);
router.get("/:id", CashInOutController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "cashInOut", entityLabel: "Cash In Out" }),
  CashInOutController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(),
  applyApprovalWorkflow({ modelKey: "cashInOut", entityLabel: "Cash In Out" }),
  CashInOutController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "cashInOut", entityLabel: "Cash In Out" }),
);
const CashInOutRoutes = router;
module.exports = CashInOutRoutes;
