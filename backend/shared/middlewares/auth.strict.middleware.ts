import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { catchAsync } from "../utils/CatchAsync";
import { redisClient } from "../../config/redis";
import { generateRedisKey } from "../../config/redisKey";
import { UserTable } from "../../modules/schema";
import { db } from "../../config/db";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

interface DecodedToken extends JwtPayload {
  id: string;
}

export const requireAuth = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith("Bearer")) {
      token = authHeader.split(" ")[1];
    }

    // 1. STRICT: Block if no token is provided
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid token.",
      });
    }

    try {
      // 2. Verify Token (Throws an error automatically if expired/invalid)
      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET as string,
      ) as DecodedToken;

      const userId = decoded.id || decoded.sub;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Invalid token payload.",
        });
      }

      const redisKey = generateRedisKey("USER_ID", userId as string);

      // 3. Redis Cache Check
      const cachedSession = await redisClient.get(redisKey);

      if (cachedSession) {
        req.user = JSON.parse(cachedSession);
        return next(); // Cache hit! Proceed.
      }

      // 4. DB Fallback
      const user = await db.query.UserTable.findFirst({
        where: eq(UserTable.id, userId as string),
      });

      // STRICT: Block if user was deleted from DB but token is still active
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "The user belonging to this token no longer exists.",
        });
      }

      // 5. Update Redis and proceed
      req.user = user;
      await redisClient.set(redisKey, JSON.stringify(user), "EX", 3600);

      next();
    } catch (error: any) {
      // 6. STRICT: Catch JWT specific errors and block access
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Your token has expired. Please log in again.",
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token. Please log in again.",
        });
      }

      // Generic fallback for any other verification errors
      return res.status(401).json({
        success: false,
        message: "Authentication failed.",
      });
    }
  },
);
