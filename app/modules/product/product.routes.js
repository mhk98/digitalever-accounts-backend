const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const ProductController = require("./product.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "product", entityLabel: "Product" }),
  ProductController.insertIntoDB,
);
router.get("/", ProductController.getAllFromDB);
router.get("/all", ProductController.getAllFromDBWithoutQuery);
router.get("/stock/:id", ProductController.getDataById);
router.get("/:id", ProductController.getReceivedDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "product", entityLabel: "Product" }),
  ProductController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "product", entityLabel: "Product" }),
  ProductController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "product", entityLabel: "Product" }),
);

const ProductRoutes = router;
module.exports = ProductRoutes;
