const ApiError = require("../../../error/ApiError");
const db = require("../../../models");
const { DEFAULT_ROLE_MENU_PERMISSIONS } = require("../../config/roleMenuPermissions");
const { ALL_MENU_PERMISSIONS } = require("../../enums/menuPermissions");
const { ENUM_USER_ROLE } = require("../../enums/user");

const RolePermission = db.rolePermission;

const validRoles = Object.values(ENUM_USER_ROLE);

const uniq = (items = []) => [...new Set(items)];

const isValidRole = (role) => validRoles.includes(role);

const normalizeMenuPermissions = (menuPermissions) => {
  if (Array.isArray(menuPermissions)) {
    return menuPermissions;
  }

  if (menuPermissions == null || menuPermissions === "") {
    return [];
  }

  if (typeof menuPermissions === "string") {
    try {
      const parsed = JSON.parse(menuPermissions);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  if (
    typeof menuPermissions === "object" &&
    Array.isArray(menuPermissions.menuPermissions)
  ) {
    return menuPermissions.menuPermissions;
  }

  return [];
};

const validateRole = (role) => {
  if (!isValidRole(role)) {
    throw new ApiError(400, "Invalid role");
  }
};

const validateMenuPermissions = (menuPermissions) => {
  const normalizedPermissions = normalizeMenuPermissions(menuPermissions);

  if (!Array.isArray(normalizedPermissions)) {
    throw new ApiError(400, "menuPermissions must be an array");
  }

  const invalidPermissions = uniq(normalizedPermissions).filter(
    (permission) => !ALL_MENU_PERMISSIONS.includes(permission),
  );

  if (invalidPermissions.length) {
    throw new ApiError(
      400,
      `Unknown menu permission(s): ${invalidPermissions.join(", ")}`,
    );
  }

  return uniq(normalizedPermissions);
};

const getDefaultPermissionsForRole = (role) => {
  validateRole(role);
  return uniq(DEFAULT_ROLE_MENU_PERMISSIONS[role] || []);
};

const getEffectiveMenuPermissions = async (role) => {
  validateRole(role);

  const record = await RolePermission.findOne({
    where: { role },
  });

  if (!record) {
    return getDefaultPermissionsForRole(role);
  }

  return validateMenuPermissions(record.menuPermissions || []);
};

const getAllRolePermissions = async () => {
  const records = await Promise.all(
    validRoles.map(async (role) => ({
      role,
      menuPermissions: await getEffectiveMenuPermissions(role),
    })),
  );

  return records;
};

const getRolePermissionByRole = async (role) => {
  return {
    role,
    menuPermissions: await getEffectiveMenuPermissions(role),
  };
};

const updateRolePermissions = async (role, menuPermissions) => {
  validateRole(role);
  const normalizedPermissions = validateMenuPermissions(menuPermissions);

  await RolePermission.upsert({
    role,
    menuPermissions: normalizedPermissions,
  });

  return getRolePermissionByRole(role);
};

const hasMenuPermission = (userPermissions = [], requiredPermission) => {
  return (
    userPermissions.includes(requiredPermission) ||
    userPermissions.includes("*") ||
    requiredPermission === "*"
  );
};

module.exports = {
  getAllRolePermissions,
  getRolePermissionByRole,
  updateRolePermissions,
  getEffectiveMenuPermissions,
  getDefaultPermissionsForRole,
  validateMenuPermissions,
  validateRole,
  isValidRole,
  hasMenuPermission,
  validRoles,
};
