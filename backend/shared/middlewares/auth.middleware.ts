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

export const optionalAuthMiddleware = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith("Bearer")) {
      token = authHeader.split(" ")[1];
    }

    // 1. Agar token nahi hai, toh Guest ki tarah aage badho
    if (!token) {
      return next();
    }

    try {
      // 2. Token Verify karo
      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET as string,
      ) as DecodedToken;

      const userId = decoded.id || decoded.sub;

      const redisKey = generateRedisKey("USER_ID", userId as string);

      // 3. Redis Check
      const cachedSession = await redisClient.get(redisKey);

      if (cachedSession) {
        req.user = JSON.parse(cachedSession);
        return next(); // Cache hit! Return immediately.
      }

      // 4. DB Fallback (Agar Cache miss hua)
      const user = await db.query.UserTable.findFirst({
        where: eq(UserTable.id, userId as string),
      });

      if (user) {
        req.user = user;

        // 🌟 MISSING STEP ADDED: Wapas Redis me save karo taaki agli baar DB call na lage
        await redisClient.set(redisKey, JSON.stringify(user), "EX", 3600);
      }

      next();
    } catch (error) {
      // 5. Agar token Expired/Invalid hai, toh error mat do. Guest samajh ke aage badho.
      next();
    }
  },
);
