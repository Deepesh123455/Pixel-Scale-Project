import { type NextFunction, type Request, type Response } from "express";
import { redisClient } from "../../config/redis";
// 🌟 1. Apni Partition Manager file import karo
import { generateRedisKey } from "../../config/redisKey" 

const WINDOW_MS = 15 * 60 * 1000; // 15 Minutes
const MAX_REQUESTS = 100;

export const slidingWindowLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip || "127.0.0.1";
    
    // 🌟 2. USE THE PARTITION SYSTEM
    // Ye banayega: "rate_limit:ip:127.0.0.1" (ya jo bhi tumne redisKeys.ts mein rakha hai)
    const key = generateRedisKey("RATE_LIMIT_IP", ip);
    
    const currentTime = Date.now();
    const windowStart = currentTime - WINDOW_MS;

    // ⚡ REDIS TRANSACTION (Atomic Operation)
    const multi = redisClient.multi();

    // 1. Purani requests (jo window ke bahar hain) delete karo
    multi.zremrangebyscore(key, 0, windowStart);

    // 2. Current window mein kitni requests hain wo count karo
    multi.zcard(key);

    // 3. Expiry badhani padegi taaki dead keys memory na khayein
    multi.expire(key, 60 * 20); // 20 mins expiry (safety buffer)

    // Execute Transaction
    const results = await multi.exec();
    
    // Results array: [deletedCount, currentCount, expireResult]
    const requestCount = results?.[1]?.[1] as number;

    if (requestCount >= MAX_REQUESTS) {
       // 🛑 LIMIT EXCEEDED
       res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
        retryAfter: `${WINDOW_MS / 1000} seconds`
      });
      return; // Return zaroori hai taaki next() call na ho
    }

    // ✅ ALLOW REQUEST (Add timestamp to Set)
    // Score = currentTime, Value = Unique string (timestamp + random)
    await redisClient.zadd(key, currentTime, `${currentTime}-${Math.random()}`);

    // Headers set karo (Industry Standard)
    res.setHeader("X-RateLimit-Limit", MAX_REQUESTS);
    res.setHeader("X-RateLimit-Remaining", MAX_REQUESTS - requestCount - 1);

    next();

  } catch (error) {
    console.error("Redis Limiter Error:", error);
    // Fail Open: Agar Redis down hai toh request jaane do (Smart move!)
    next();
  }
};