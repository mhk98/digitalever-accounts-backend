const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const ReturnProductController = require("./returnProduct.controller");
const router = require("express").Router();

router.post("/create", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), ReturnProductController.insertIntoDB);
router.get("/", ReturnProductController.getAllFromDB);
router.get("/all", ReturnProductController.getAllFromDBWithoutQuery);
router.get("/", ReturnProductController.getDataById);
router.delete("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), ReturnProductController.deleteIdFromDB);
router.patch("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), ReturnProductController.updateOneFromDB);

const ReturnProductRoutes = router;
module.exports =  ReturnProductRoutes ;
