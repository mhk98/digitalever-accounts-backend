const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const PurchaseRequisitionController = require("./purchaseRequisition.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  PurchaseRequisitionController.insertIntoDB,
);
router.get("/", PurchaseRequisitionController.getAllFromDB);
router.get("/all", PurchaseRequisitionController.getAllFromDBWithoutQuery);
router.get("/", PurchaseRequisitionController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  PurchaseRequisitionController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  PurchaseRequisitionController.updateOneFromDB,
);

const PurchaseRequisitionRoutes = router;
module.exports = PurchaseRequisitionRoutes;
