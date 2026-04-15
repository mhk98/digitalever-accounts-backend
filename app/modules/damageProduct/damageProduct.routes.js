const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  applyApprovalWorkflow,
  approvePendingWorkflow,
} = require("../../middlewares/approvalRouteWorkflow");
const DamageProductController = require("./damageProduct.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(),
  applyApprovalWorkflow({ modelKey: "damageProduct", entityLabel: "Damage Product" }),
  DamageProductController.insertIntoDB,
);
router.get("/", DamageProductController.getAllFromDB);
router.get("/all", DamageProductController.getAllFromDBWithoutQuery);
router.get("/", DamageProductController.getDataById);
router.delete(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "damageProduct", entityLabel: "Damage Product" }),
  DamageProductController.deleteIdFromDB,
);
router.put(
  "/:id",
  auth(),
  applyApprovalWorkflow({ modelKey: "damageProduct", entityLabel: "Damage Product" }),
  DamageProductController.updateOneFromDB,
);
router.post(
  "/:id/approve",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  approvePendingWorkflow({ modelKey: "damageProduct", entityLabel: "Damage Product" }),
);

const DamageProductRoutes = router;
module.exports = DamageProductRoutes;
