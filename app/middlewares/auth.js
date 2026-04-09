const jwt = require("jsonwebtoken");
const ApiError = require("../../error/ApiError");
const RolePermissionService = require("../modules/rolePermission/rolePermission.service");

const auth =
  (...requiredRoles) =>
  async (req, res, next) => {
    try {
      // Get authorization token
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return next(new ApiError(401, "You are not authorized"));

      // Verify token
      const verifiedUser = jwt.verify(token, process.env.TOKEN_SECRET);
      req.user = verifiedUser; // Add user info to request object
      req.menuPermissions =
        await RolePermissionService.getEffectiveMenuPermissions(verifiedUser.role);

      // Check if the user's role is one of the required roles
      if (requiredRoles.length && !requiredRoles.includes(verifiedUser.role)) {
        return next(new ApiError(403, "Forbidden"));
      }

      // Proceed to next middleware or route handler
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new ApiError(401, "Invalid token"));
      }
      return next(error);
    }
  };

module.exports = auth;
