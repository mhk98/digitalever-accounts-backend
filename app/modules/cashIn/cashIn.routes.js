const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const CashInController = require("./cashIn.controller");
const router = require("express").Router();

router.post("/create", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), CashInController.insertIntoDB);
router.get("/", CashInController.getAllFromDB);
router.get("/all", CashInController.getAllFromDBWithoutQuery);
router.get("/:id", CashInController.getDataById);
router.delete("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), CashInController.deleteIdFromDB);
router.patch("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), CashInController.updateOneFromDB);
const CashInRoutes = router;
module.exports =  CashInRoutes ;