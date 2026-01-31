const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const DamageRepairController = require("./damageRepair.controller");
const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  DamageRepairController.insertIntoDB,
);
router.get("/", DamageRepairController.getAllFromDB);
router.get("/all", DamageRepairController.getAllFromDBWithoutQuery);
router.get("/", DamageRepairController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  DamageRepairController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  DamageRepairController.updateOneFromDB,
);

const DamageRepairRoutes = router;
module.exports = DamageRepairRoutes;
