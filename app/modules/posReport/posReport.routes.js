const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const PosReportController = require("./posReport.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  PosReportController.insertIntoDB,
);
router.get("/", PosReportController.getAllFromDB);
router.get("/all", PosReportController.getAllFromDBWithoutQuery);
router.get("/", PosReportController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  PosReportController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  PosReportController.updateOneFromDB,
);

const PosReportRoutes = router;
module.exports = PosReportRoutes;
