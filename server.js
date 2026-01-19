// const express = require("express");
// const cors = require("cors");
// const cookieParser = require("cookie-parser");
// const http = require("http");

// require("./models"); // Sequelize models init
// require("dotenv").config();

// const routes = require("./app/routes");
// const ApiError = require("./error/ApiError");

// const app = express();

// /**
//  * ✅ CORS (Dev)
//  * Frontend: http://localhost:5173
//  * Backend:  http://localhost:5000
//  */
// const allowedOrigins = ["http://localhost:5173"];

// const corsOptions = {
//   origin: (origin, callback) => {
//     // allow requests with no origin (Postman, curl, mobile apps)
//     if (!origin) return callback(null, true);

//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }

//     return callback(new Error(`Not allowed by CORS: ${origin}`));
//   },
//   credentials: true, // ✅ if you use cookies/auth
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
//   optionsSuccessStatus: 204,
// };

// // ✅ must be BEFORE routes
// app.use(cors(corsOptions));

// // ✅ handle preflight for all routes
// app.options("*", cors(corsOptions));

// /**
//  * ✅ Parsers / Cookies
//  */
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());
// app.use(cookieParser());

// /**
//  * ✅ Static
//  */
// app.use("/images", express.static("images"));

// /**
//  * ✅ Root
//  */
// app.get("/", (req, res) => {
//   res.send("Server is running");
// });

// /**
//  * ✅ Routes
//  */
// app.use("/api/v1", routes);

// /**
//  * ✅ 404
//  */
// app.use((req, res) => {
//   res.status(404).json({ error: "API not found" });
// });

// /**
//  * ✅ Global Error Handler
//  */
// app.use((err, req, res, next) => {
//   // CORS error (from our custom callback)
//   if (err && err.message && err.message.startsWith("Not allowed by CORS")) {
//     return res.status(403).json({
//       status: "error",
//       message: err.message,
//     });
//   }

//   if (err instanceof ApiError) {
//     return res.status(err.statusCode || 500).json({
//       status: "error",
//       message: err.message,
//       ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
//     });
//   }

//   console.error(err);
//   return res.status(500).json({
//     status: "error",
//     message: "Internal server error",
//   });
// });

// /**
//  * ✅ Server
//  */
// const port = process.env.PORT || 5000;
// const server = http.createServer(app);

// server.listen(port, () => {
//   console.log(`Server is listening at http://localhost:${port}`);
// });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const http = require("http");
require("./models"); // Your database models (e.g., Sequelize models)
require("dotenv").config();
const routes = require("./app/routes"); // Import your routes
const ApiError = require("./error/ApiError");

const app = express();

// Apply CORS Middleware
// app.use(cors({
//   origin: ['https://insaniat.xyz/'],
//   credentials: true
// }));

app.use(cors({ origin: true, credentials: true }));

// Express built-in middleware for parsing request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Static image folder
app.use("/images", express.static("images"));

// Main route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// API routes
app.use("/api/v1", routes);

// Catch-all route for handling API not found
app.use((req, res) => {
  res.status(404).json({ error: "API not found" });
});

// // Global Error Handler Middleware
// app.use((err, req, res, next) => {
//   console.error(err);  // Log the error for debugging

//   // Check if the error is an instance of ApiError
//   if (err instanceof ApiError) {
//     return res.status(err.statusCode || 500).json({
//       message: err.message,
//       stack: process.env.NODE_ENV === 'development' ? err.stack : undefined  // Only include stack trace in development
//     });
//   }

//   // If it's any other error, respond with a generic server error
//   res.status(500).json({
//     message: "Internal Server Error",
//     stack: process.env.NODE_ENV === 'development' ? err.stack : undefined // Avoid exposing stack trace in production
//   });
// });

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      // Optionally include stack trace if it's an internal error
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // For unexpected errors, return a generic message
  console.error(err);
  return res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

// Server setup
const port = process.env.PORT || 5000; // Use environment variable if available
const server = http.createServer(app);

// Start listening
server.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});
