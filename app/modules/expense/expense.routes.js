const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const ExpenseController = require("./expense.controller");
const router = require("express").Router();

router.post("/create", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), ExpenseController.insertIntoDB);
router.get("/", ExpenseController.getAllFromDB);
router.get("/all", ExpenseController.getAllFromDBWithoutQuery);
router.get("/:id", ExpenseController.getDataById);
router.delete("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), ExpenseController.deleteIdFromDB);
router.patch("/:id", auth( ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN), ExpenseController.updateOneFromDB);
const ExpenseRoutes = router;
module.exports =  ExpenseRoutes ;