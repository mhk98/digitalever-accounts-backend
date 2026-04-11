const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const { uploadSingle } = require("../../middlewares/upload");
const UserController = require("./user.controller");
const router = require("express").Router();

// Define routes
router.post("/login", UserController.login);
router.post("/register", uploadSingle, UserController.register);
router.get(
  "/",
  auth(),
  requireMenuPermission("user_management"),
  UserController.getAllUserFromDB,
); // This gets all users
router.get(
  "/:id",
  // auth(),
  // requireMenuPermission("user_management"),
  UserController.getUserById,
); // Use :id to get a user by ID
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  requireMenuPermission("user_management"),
  UserController.deleteUserFromDB,
);
router.put(
  "/:id",
  // auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  // requireMenuPermission("user_management"),
  uploadSingle,
  UserController.updateUserFromDB,
);

// Export the router
const UserRoutes = router;
module.exports = UserRoutes;
