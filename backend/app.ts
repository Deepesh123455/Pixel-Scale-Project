import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import hpp from "hpp"; // HTTP Parameter Pollution rokne ke liye
import dotenv from "dotenv";
import pinoHttp from "pino-http";
import { globalErrorHandler } from "./shared/middlewares/error.middleware";
import router from "./modules/auth/auth.routes";
dotenv.config();

// 📦 Modular Imports
import { ApiError } from "./shared/utils/AppError"; // Tumhara updated naam
import { slidingWindowLimiter } from "./shared/middlewares/rate-limiter.middleware";
import { speedLimiter } from "./shared/middlewares/speed-limiter.middleware";

// Global error handler ko bhi yahan import kar lenge
// import {  } from "./shared/middlewares/error.middleware";

const app: Application = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    transport:
      process.env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
        headers: {
          host: req.headers.host,
          user_agent: req.headers["user_agent"],
        },
      }),
    },

    autoLogging: {
      ignore: (req) => req.url === "/health",
    },
  }),
);

// ==========================================
// 🛡️ 1. GLOBAL MIDDLEWARES & SECURITY
// ==========================================

// Security Headers (Fixed the helmet invocation)
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  }),
);

// DDoS & Brute Force Prevention (Applied to all /api routes)
app.use("/api", slidingWindowLimiter);
app.use("/api", speedLimiter);

// ==========================================
// 📦 2. PAYLOAD PARSERS & OPTIMIZATIONS
// ==========================================

// Body parsers with strict size limits (RAM Crash Prevention)
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Cookie parser for secure JWT Refresh Tokens
app.use(cookieParser());

// Prevent HTTP Parameter Pollution attacks
app.use(hpp());

// Compress response bodies for faster API responses
app.use(compression());

// ==========================================
// 🚦 3. ROUTES & HEALTH CHECK
// ==========================================

// Load Balancer & Uptime Monitoring ke liye
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "PixelScale Fortress is UP and SECURE! 🛡️",
  });
});

app.use("/api/v1/auth", router);

// ==========================================
// 🚫 4. UNHANDLED ROUTES & ERROR HANDLING
// ==========================================


// Bina kisi path string ke! Ye automatically har us request ko pakdega jo upar match nahi hui.
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new ApiError(`Route ${req.originalUrl} not found on this server!`, 404));
});

// 🚨 The Global Error Handler (Hamesha file ke end mein hona chahiye)
app.use(globalErrorHandler);

export { app };
