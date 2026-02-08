const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const AssetsRequisitionController = require("./assetsRequisition.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  AssetsRequisitionController.insertIntoDB,
);
router.get("/", AssetsRequisitionController.getAllFromDB);
router.get("/all", AssetsRequisitionController.getAllFromDBWithoutQuery);
router.get("/:id", AssetsRequisitionController.getDataById);
router.delete(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  AssetsRequisitionController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  AssetsRequisitionController.updateOneFromDB,
);

const AssetsRequisitionRoutes = router;
module.exports = AssetsRequisitionRoutes;
