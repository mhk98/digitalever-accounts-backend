const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const AssetsPurchaseController = require("./assetsPurchase.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsPurchase", entityLabel: "Assets Purchase" }),
  AssetsPurchaseController.insertIntoDB,
);
router.get("/", AssetsPurchaseController.getAllFromDB);
router.get("/all", AssetsPurchaseController.getAllFromDBWithoutQuery);
router.get("/:id", AssetsPurchaseController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsPurchase", entityLabel: "Assets Purchase" }),
  AssetsPurchaseController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "assetsPurchase", entityLabel: "Assets Purchase" }),
  AssetsPurchaseController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "assetsPurchase", entityLabel: "Assets Purchase" }),
);

const AssetsPurchaseRoutes = router;
module.exports = AssetsPurchaseRoutes;
