const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const PurchaseRequisitionController = require("./purchaseRequisition.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "purchaseRequisition", entityLabel: "Purchase Requisition" }),
  PurchaseRequisitionController.insertIntoDB,
);
router.get("/", PurchaseRequisitionController.getAllFromDB);
router.get("/all", PurchaseRequisitionController.getAllFromDBWithoutQuery);
router.get("/", PurchaseRequisitionController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "purchaseRequisition", entityLabel: "Purchase Requisition" }),
  PurchaseRequisitionController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "purchaseRequisition", entityLabel: "Purchase Requisition" }),
  PurchaseRequisitionController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "purchaseRequisition", entityLabel: "Purchase Requisition" }),
);

const PurchaseRequisitionRoutes = router;
module.exports = PurchaseRequisitionRoutes;
