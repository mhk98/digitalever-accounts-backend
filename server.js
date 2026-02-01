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

// const express = require("express");
// const cors = require("cors");
// const cookieParser = require("cookie-parser");
// const bodyParser = require("body-parser");
// const http = require("http");
// require("dotenv").config();

// require("./models"); // DB models (e.g. Sequelize)
// const routes = require("./app/routes"); // Your routes
// const ApiError = require("./error/ApiError");

// const app = express();

// // Allowed frontend origins
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://accounts.digitalever.com.bd",
//   "https://digitalever.com.bd",
// ];

// // CORS options
// const corsOptions = {
//   origin: (origin, callback) => {
//     // Allow Postman / server-to-server (no origin header)
//     if (!origin) return callback(null, true);

//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }

//     console.warn("Blocked by CORS:", origin);
//     return callback(new Error("Not allowed by CORS"), false);
//   },
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
//   credentials: true,
// };

// // 1) CORS middleware (must be before routes)
// app.use(cors(corsOptions));

// // 2) Explicit preflight handler for all routes
// app.options("*", (req, res) => {
//   const origin = req.headers.origin;
//   if (origin && allowedOrigins.includes(origin)) {
//     res.header("Access-Control-Allow-Origin", origin);
//   }
//   res.header(
//     "Access-Control-Allow-Methods",
//     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
//   );
//   res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
//   res.header("Access-Control-Allow-Credentials", "true");
//   return res.sendStatus(200); // Must be HTTP 200 OK
// });

// // 3) Body parsers & cookies
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(cookieParser());

// // 4) Routes
// app.use("/api/v1", routes);

// // 5) 404 handler (optional)
// app.use((req, res, next) => {
//   const error = new ApiError("Not Found", 404);
//   next(error);
// });

// // 6) Error handler
// app.use((err, req, res, next) => {
//   if (err instanceof ApiError) {
//     return res.status(err.status).json({ message: err.message });
//   }

//   console.error("Unhandled error:", err);
//   return res.status(500).json({ message: "Internal server error" });
// });

// // 7) Start HTTP server
// const PORT = process.env.PORT || 5000;
// const server = http.createServer(app);

// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
