const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const PettyCashController = require("./pettyCash.controller");
const router = require("express").Router();

router.post("/create", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), PettyCashController.insertIntoDB);
router.get("/", PettyCashController.getAllFromDB);
router.get("/all", PettyCashController.getAllFromDBWithoutQuery);
router.get("/:id", PettyCashController.getDataById);
router.delete("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), PettyCashController.deleteIdFromDB);
router.patch("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), PettyCashController.updateOneFromDB);
const PettyCashRoutes = router;
module.exports =  PettyCashRoutes ;