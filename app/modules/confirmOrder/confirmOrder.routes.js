const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const ConfirmOrderController = require("./confirmOrder.controller");
const router = require("express").Router();

router.post("/create", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), ConfirmOrderController.insertIntoDB);
router.get("/", ConfirmOrderController.getAllFromDB);
router.get("/all", ConfirmOrderController.getAllFromDBWithoutQuery);
router.get("/", ConfirmOrderController.getDataById);
router.delete("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), ConfirmOrderController.deleteIdFromDB);
router.patch("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), ConfirmOrderController.updateOneFromDB);

const ConfirmOrderRoutes = router;
module.exports =  ConfirmOrderRoutes ;
