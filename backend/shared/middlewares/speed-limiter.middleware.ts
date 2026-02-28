import { type NextFunction, type Request, type Response } from "express";
import { redisClient } from "../../config/redis";

// --- Configuration ---
const WINDOW_MS = 15 * 60 * 1000; // 15 Minutes window
const DELAY_AFTER = 50;           // 50 requests ke baad slow karna shuru karo
const BASE_DELAY_MS = 500;        // Har extra request pe 500ms ka delay badhao
const MAX_DELAY_MS = 3000;        // Maximum 3 second ka delay (Taaki timeout na ho)

export const speedLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || "127.0.0.1";
  const key = `sl_throttle:${ip}`;

  try {
    // 1. Atomic Increment (Fastest Redis Op)
    // Yeh count badhayega aur current value return karega
    const hits = await redisClient.incr(key);

    // 2. Agar yeh pehli request hai, toh expiry set karo
    if (hits === 1) {
      await redisClient.expire(key, WINDOW_MS / 1000);
    }

    // 3. Check karo ki kya limit cross hui hai?
    if (hits > DELAY_AFTER) {
      // --- CALCULATION MAGIC 🧮 ---
      // Example: 51st request -> (51-50) * 500 = 500ms delay
      // Example: 55th request -> (55-50) * 500 = 2500ms delay
      const overLimit = hits - DELAY_AFTER;
      let delay = overLimit * BASE_DELAY_MS;

      // Cap the delay (Industry standard: Kabhi bhi infinite delay mat do)
      if (delay > MAX_DELAY_MS) {
        delay = MAX_DELAY_MS;
      }

      // 4. Client ko batao ki wo slow kyu hua (Debugging ke liye best)
      res.setHeader("X-Slow-Down-Delay", delay);
      res.setHeader("X-Slow-Down-Limit", DELAY_AFTER);
      res.setHeader("X-Slow-Down-Current", hits);

      console.log(`🐢 Throttling IP ${ip} for ${delay}ms (Request #${hits})`);

      // 5. THE WAIT (Server-side pause)
      // Request yahi ruk jayegi aur delay ke baad 'next()' call hoga
      setTimeout(() => {
        next();
      }, delay);
      
      return; // Return zaroori hai taaki immediate next() call na ho jaye
    }

    // Agar limit ke andar hai, toh fast jaane do 🚀
    next();

  } catch (error) {
    console.error("Speed Limiter Redis Error:", error);
    // Fail Open: Agar Redis down hai, toh user ko mat roko, jaane do.
    next(); 
  }
};