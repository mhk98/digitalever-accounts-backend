const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireMenuPermission,
} = require("../../middlewares/requireMenuPermission");
const { uploadSingle, uploadUserDocuments } = require("../../middlewares/upload");
const UserController = require("./user.controller");
const router = require("express").Router();

// Define routes
router.post("/login", UserController.login);
router.post("/logout", auth(), UserController.logout);
router.post("/register", uploadUserDocuments, UserController.register);
router.get(
  "/",
  auth(),
  requireMenuPermission("user_management"),
  UserController.getAllUserFromDB,
); // This gets all users
router.get(
  "/:id",
  auth(),
  // requireMenuPermission("user_management"),
  UserController.getUserById,
); // Use :id to get a user by ID
router.put(
  "/:id/status",
  auth(ENUM_USER_ROLE.SUPER_ADMIN),
  requireMenuPermission("user_management"),
  UserController.updateUserStatusFromDB,
);
router.post(
  "/:id/impersonate",
  auth(ENUM_USER_ROLE.SUPER_ADMIN),
  requireMenuPermission("user_management"),
  UserController.impersonateUser,
);
router.delete(
  "/:id",
  auth(),
  requireMenuPermission("user_management"),
  UserController.deleteUserFromDB,
);
router.put(
  "/:id",
  auth(),
  // requireMenuPermission("user_management"),
  uploadUserDocuments,
  UserController.updateUserFromDB,
);

// Export the router
const UserRoutes = router;
module.exports = UserRoutes;
