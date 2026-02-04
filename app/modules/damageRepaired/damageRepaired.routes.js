const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const DamageRepairedController = require("./damageRepaired.controller");

const router = require("express").Router();

router.post(
  "/create",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  DamageRepairedController.insertIntoDB,
);
router.get("/", DamageRepairedController.getAllFromDB);
router.get("/all", DamageRepairedController.getAllFromDBWithoutQuery);
router.get("/", DamageRepairedController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  DamageRepairedController.deleteIdFromDB,
);
router.patch(
  "/:id",
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  DamageRepairedController.updateOneFromDB,
);

const DamageRepairedRoutes = router;
module.exports = DamageRepairedRoutes;
