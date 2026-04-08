// const express = require("express");
// const cors = require("cors");
// const cookieParser = require("cookie-parser");
// const bodyParser = require("body-parser");
// const http = require("http");
// require("./models");
// require("dotenv").config();
// const routes = require("./app/routes"); // Import your routes
// const ApiError = require("./error/ApiError");

// const app = express();

// // Apply CORS Middleware
// // app.use(cors({
// //   origin: ['https://insaniat.xyz/'],
// //   credentials: true
// // }));

// app.use(cors({ origin: true, credentials: true }));

// // Express built-in middleware for parsing request bodies
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());
// app.use(cookieParser());

// // Static image folder
// app.use("/images", express.static("images"));

// // Main route
// app.get("/", (req, res) => {
//   res.send("Server is running");
// });

// // API routes
// app.use("/api/v1", routes);

// // Catch-all route for handling API not found
// app.use((req, res) => {
//   res.status(404).json({ error: "API not found" });
// });

// // Global error handler
// app.use((err, req, res, next) => {
//   if (err instanceof ApiError) {
//     return res.status(err.statusCode).json({
//       status: "error",
//       message: err.message,
//       // Optionally include stack trace if it's an internal error
//       ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
//     });
//   }

//   // For unexpected errors, return a generic message
//   console.error(err);
//   return res.status(500).json({
//     status: "error",
//     message: "Internal server error",
//   });
// });

// // Server setup
// const port = process.env.PORT || 5000; // Use environment variable if available
// const server = http.createServer(app);

// // Start listening
// server.listen(port, () => {
//   console.log(`Server is listening at http://localhost:${port}`);
// });

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");

const db = require("./models"); // Sequelize instance
const routes = require("./app/routes");
const ApiError = require("./error/ApiError");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

/* ========================
   MIDDLEWARE
======================== */

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

/* ========================
   STATIC FILES
======================== */

app.use("/images", express.static("images"));

/* ========================
   ROUTES
======================== */

// Health check route (important for monitoring)
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "API server is running",
  });
});

app.use("/api/v1", routes);

/* ========================
   404 HANDLER
======================== */

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "API not found",
  });
});

/* ========================
   GLOBAL ERROR HANDLER
======================== */

app.use((err, req, res, next) => {
  console.error("Global Error:", err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...(process.env.NODE_ENV === "development" && {
        stack: err.stack,
      }),
    });
  }

  return res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

/* ========================
   SERVER START FUNCTION
======================== */

const startServer = async () => {
  try {
    // Authenticate DB connection
    await db.sequelize.authenticate();
    console.log("✅ Database connected successfully");

    // Sync models (optional in production)
    // await db.sequelize.sync();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1); // Exit if DB fails
  }
};

startServer();

/* ========================
   GRACEFUL SHUTDOWN
======================== */

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await db.sequelize.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down gracefully...");
  await db.sequelize.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// // 🔹 Memory limit (VERY IMPORTANT for cPanel)
// process.env.NODE_OPTIONS = "--max-old-space-size=1024";

// require("dotenv").config(); // ⬅️ dotenv first
// require("./models");

// const express = require("express");
// const cors = require("cors");
// const cookieParser = require("cookie-parser");

// const routes = require("./app/routes");
// const ApiError = require("./error/ApiError");

// const app = express();

// /* -------------------- CORS -------------------- */
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://kafelamart.digitalever.com.bd",
// ];

// const corsOptions = {
//   origin: (origin, callback) => {
//     if (!origin || allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }
//     // ❗ crash না করে deny
//     return callback(null, false);
//   },
//   credentials: true,
// };

// app.use(cors(corsOptions));
// app.options("*", cors(corsOptions));

// /* -------------------- Middleware -------------------- */
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());
// app.use(cookieParser());

// /* -------------------- Static -------------------- */
// app.use("/media", express.static("media"));

// /* -------------------- Routes -------------------- */
// app.get("/", (req, res) => {
//   res.send("API server is running");
// });

// app.use("/api/v1", routes);

// /* -------------------- 404 -------------------- */
// app.use((req, res) => {
//   res.status(404).json({ error: "API not found" });
// });

// /* -------------------- Error Handler -------------------- */
// app.use((err, req, res, next) => {
//   if (err instanceof ApiError) {
//     return res.status(err.statusCode).json({
//       status: "error",
//       message: err.message,
//       ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
//     });
//   }

//   console.error(err);
//   res.status(500).json({
//     status: "error",
//     message: "Internal server error",
//   });
// });

// /* -------------------- Server -------------------- */
// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
