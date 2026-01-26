const express = require("express");
const router = express.Router();
const NotificationController = require("../notification/notification.controller");

// branch ভিত্তিক notification
router.get("/:userId", NotificationController.getNotificationByUser);

// router.post("/", NotificationController.createNotification);
router.put("/:id/read", NotificationController.markAsReadNotification);

const NotificationRoutes = router;
module.exports = NotificationRoutes;
