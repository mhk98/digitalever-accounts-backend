const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const { uploadFile } = require("../../middlewares/upload");
const {
  applyApprovalWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");

const PettyCashController = require("./pettyCash.controller");
const router = require("express").Router();
const pettyCashAccess = requireAnyPermission([
  "petty_cash",
  "petty_cash_requisition",
]);

const isRequisitionMode = (value) => String(value || "").trim() === "requisition";

const applyPettyCashApprovalWorkflow = (req, res, next) => {
  const mode = req.body?.mode || req.query?.mode;
  const isReq =
    isRequisitionMode(mode) ||
    (req.method === "POST" &&
      String(req.body?.paymentStatus || "").trim() === "CashIn");

  if (!isReq) {
    return next();
  }

  const modelKey = "pettyCashRequisition";
  const entityLabel = "Petty Cash Requisition";

  return applyApprovalWorkflow({ modelKey, entityLabel })(req, res, next);
};

router.post(
  "/create",
  uploadFile,
  auth(),
  pettyCashAccess,
  applyPettyCashApprovalWorkflow,
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
  applyPettyCashApprovalWorkflow,
  PettyCashController.deleteIdFromDB,
);
router.put(
  "/:id",
  uploadFile,
  auth(),
  pettyCashAccess,
  applyPettyCashApprovalWorkflow,
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
