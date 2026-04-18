const { ENUM_USER_ROLE } = require("../../enums/user");
const auth = require("../../middlewares/auth");
const {
  requireAnyPermission,
} = require("../../middlewares/requireMenuPermission");
const DailyWorkReportController = require("./dailyWorkReport.controller");

const router = require("express").Router();

router.post(
  "/create",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.submitReport,
);
router.get(
  "/me",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.getMyReports,
);
router.put(
  "/:id",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.updateMyReport,
);
router.get(
  "/",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.getAllReports,
);
router.get(
  "/:id",
  auth(),
  requireAnyPermission([
    "daily_work_reports",
    "employee_profile",
    "employee_list",
    "employee_management",
  ]),
  DailyWorkReportController.getDataById,
);
router.put(
  "/:id/review",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT),
  requireAnyPermission(["employee_list", "employee_management"]),
  DailyWorkReportController.reviewReport,
);
router.post(
  "/send-reminders",
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.ACCOUNTANT),
  requireAnyPermission(["employee_list", "employee_management"]),
  DailyWorkReportController.sendPendingReminders,
);

module.exports = router;
