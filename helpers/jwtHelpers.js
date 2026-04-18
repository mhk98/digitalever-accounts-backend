const jwt = require("jsonwebtoken");
const ApiError = require("../error/ApiError");
require("dotenv").config();

exports.generateToken = (userInfo, extraClaims = {}) => {
  try {
    const payload = {
      Id: userInfo.Id,
      Email: userInfo.Email,
      role: userInfo.role,
      ...extraClaims,
    };

    // Token generation with 24 hours expiration
    const token = jwt.sign(payload, process.env.TOKEN_SECRET, {
      expiresIn: "1d", // 1 month + 10 days
    });

    return token;
  } catch (error) {
    console.error("Error generating token:", error);
    throw new ApiError(500, "Token generation failed");
  }
};
