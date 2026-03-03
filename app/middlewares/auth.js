const jwt = require("jsonwebtoken");

const auth =
  (...requiredRoles) =>
  async (req, res, next) => {
    try {
      // Get authorization token
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({
          status: "fail",
          error: "You are not authorized",
        });
      }

      // Verify token
      const verifiedUser = jwt.verify(token, process.env.TOKEN_SECRET);
      req.user = verifiedUser; // Add user info to request object

      // Debugging log to verify token and user info
      console.log("Verified User:", verifiedUser);
      console.log("Required Roles:", requiredRoles);

      // Check if the user's role is one of the required roles
      if (requiredRoles.length && !requiredRoles.includes(verifiedUser.role)) {
        return res.status(403).json({
          status: "fail",
          error: "Forbidden",
        });
      }

      // Proceed to next middleware or route handler
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          status: "fail",
          error: "Invalid token",
        });
      }
      return res.status(500).json({
        status: "error",
        error: error.message,
      });
    }
  };

module.exports = auth;
