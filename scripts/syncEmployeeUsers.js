// require("dotenv").config();

// const db = require("../models");

// const DEFAULT_PASSWORD = "123456";
// const EMPLOYEE_ROLE = "employee";
// const EMPLOYEE_DEFAULT_PERMISSIONS = ["overview", "profile"];

// const normalizeNameParts = (name = "") => {
//   const trimmedName = String(name).trim().replace(/\s+/g, " ");
//   const parts = trimmedName.split(" ").filter(Boolean);

//   if (parts.length === 2) {
//     return {
//       FirstName: parts[0],
//       LastName: parts[1],
//     };
//   }

//   return {
//     FirstName: trimmedName || "Employee",
//     LastName: null,
//   };
// };

// const generateEmailBase = (name = "", employeeId) => {
//   const slug = String(name)
//     .toLowerCase()
//     .normalize("NFKD")
//     .replace(/[^\w\s.-]/g, "")
//     .replace(/_/g, "")
//     .trim()
//     .replace(/\s+/g, ".");

//   return slug || `employee.${employeeId}`;
// };

// const findAvailableEmail = async (baseEmail, employeeId) => {
//   const candidates = [
//     `${baseEmail}@kafela.com.bd`,
//     `${baseEmail}.${employeeId}@kafela.com.bd`,
//   ];

//   for (let index = 2; index < 1000; index += 1) {
//     candidates.push(`${baseEmail}.${employeeId}.${index}@kafela.com.bd`);
//   }

//   for (const email of candidates) {
//     const existingUser = await db.user.findOne({ where: { Email: email } });
//     if (!existingUser) {
//       return email;
//     }
//   }

//   throw new Error(`Could not generate unique email for employee ${employeeId}`);
// };

// const ensureEmployeeRole = async () => {
//   await db.sequelize.query(`
//     ALTER TABLE \`Users\`
//     MODIFY \`role\` ENUM(
//       'superAdmin',
//       'admin',
//       'marketer',
//       'leader',
//       'inventor',
//       'accountant',
//       'staff',
//       'employee',
//       'user'
//     ) DEFAULT 'user'
//   `);

//   await db.rolePermission.findOrCreate({
//     where: { role: EMPLOYEE_ROLE },
//     defaults: {
//       role: EMPLOYEE_ROLE,
//       menuPermissions: EMPLOYEE_DEFAULT_PERMISSIONS,
//     },
//   });
// };

// const syncEmployeeUsers = async () => {
//   await ensureEmployeeRole();

//   const employees = await db.employeeList.findAll({
//     where: { deletedAt: null },
//     order: [["Id", "ASC"]],
//   });

//   let createdCount = 0;
//   let skippedCount = 0;

//   for (const employee of employees) {
//     const employeeName = String(employee.name || "").trim();
//     const employeeId = employee.employee_id;

//     const existingByPhone = await db.user.findOne({
//       where: { Phone: String(employeeId) },
//     });

//     if (existingByPhone) {
//       skippedCount += 1;
//       continue;
//     }

//     const { FirstName, LastName } = normalizeNameParts(employeeName);
//     const emailBase = generateEmailBase(employeeName, employeeId);
//     const email = await findAvailableEmail(emailBase, employeeId);

//     await db.user.create({
//       FirstName,
//       LastName,
//       Email: email,
//       Password: DEFAULT_PASSWORD,
//       Phone: String(employeeId),
//       role: EMPLOYEE_ROLE,
//     });

//     createdCount += 1;
//   }

//   console.log(
//     JSON.stringify(
//       {
//         totalEmployees: employees.length,
//         createdCount,
//         skippedCount,
//         defaultPassword: DEFAULT_PASSWORD,
//         role: EMPLOYEE_ROLE,
//       },
//       null,
//       2,
//     ),
//   );
// };

// syncEmployeeUsers()
//   .catch((error) => {
//     console.error("Failed to sync employee users:", error);
//     process.exitCode = 1;
//   })
//   .finally(async () => {
//     await db.sequelize.close();
//   });
