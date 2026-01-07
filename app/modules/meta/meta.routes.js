const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const MetaController = require("./meta.controller");
const router = require("express").Router();

router.post("/create", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), MetaController.insertIntoDB);
router.get("/", MetaController.getAllFromDB);
router.get("/all", MetaController.getAllFromDBWithoutQuery);
router.get("/:id", MetaController.getDataById);
router.delete("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), MetaController.deleteIdFromDB);
router.patch("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), MetaController.updateOneFromDB);
const MetaRoutes = router;
module.exports =  MetaRoutes ;