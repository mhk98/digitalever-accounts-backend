const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const { uploadFile } = require("../../middlewares/upload");
const ReceivedProductController = require("./receivedProduct.controller");
const router = require("express").Router();

router.post(
  "/create",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  ReceivedProductController.insertIntoDB,
);
router.get("/", ReceivedProductController.getAllFromDB);
router.get("/all", ReceivedProductController.getAllFromDBWithoutQuery);
router.get("/:id", ReceivedProductController.getDataById);
router.delete(
  "/:id",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  ReceivedProductController.deleteIdFromDB,
);
router.patch(
  "/:id",
  uploadFile,
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.INVENTOR,
  ),
  ReceivedProductController.updateOneFromDB,
);

const ReceivedProductRoutes = router;
module.exports = ReceivedProductRoutes;
