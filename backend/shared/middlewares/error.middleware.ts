import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/AppError";

// ---------------------------------------------------
// 🛠️ Helper Functions for Specific Errors
// ---------------------------------------------------

const handleCastErrorDB = (err: any) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new ApiError(message, 400);
};

const handleDuplicateFieldsDB = (err: any) => {
  // Regex to match value between quotes if needed, or use err.detail from Postgres
  const value = err.detail ? err.detail.match(/\(([^)]+)\)/)?.[1] : "field"; 
  const message = `Duplicate field value: "${value}". Please use another value!`;
  return new ApiError(message, 400);
};

const handleJWTError = () =>
  new ApiError("Invalid token. Please log in again!", 401);

const handleJWTExpiredError = () =>
  new ApiError("Your token has expired! Please log in again.", 401);

// ---------------------------------------------------
// 🛠️ Response Senders
// ---------------------------------------------------

const sendErrorDev = (err: any, res: Response) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: any, res: Response) => {
  // A. Operational, trusted error: send message to client
  if (err.operational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
  // B. Programming or other unknown error: don't leak details
  else {
    // 1. Log error
    console.error("ERROR 💥", err);

    // 2. Send generic message
    res.status(500).json({
      status: "error",
      message: "Something went very wrong!",
    });
  }
};

// ---------------------------------------------------
// 🏗️ The Global Error Middleware
// ---------------------------------------------------

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    // ⚠️ CRITICAL: Create a copy of the error object
    // The spread operator (...) doesn't always copy 'name' and 'message' from Error objects
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;

    // 1. Handle Invalid Database IDs (CastError)
    if (error.name === "CastError") error = handleCastErrorDB(error);

    // 2. Handle Duplicate Fields (Postgres Code 23505)
    if (error.code === "23505") error = handleDuplicateFieldsDB(error);

    // 3. Handle JWT Errors
    if (error.name === "JsonWebTokenError") error = handleJWTError();
    if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};