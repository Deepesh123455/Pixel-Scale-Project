import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// 1. Instance bante hi connection shuru ho jayega
export const redisClient = new Redis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: null,
  tls: {
    rejectUnauthorized: false, // Upstash/Cloud Redis ke liye zaroori hai
  },
});

// 2. 🌟 THE FIX: Listeners ko turant attach karo
// Bina kisi function ka wait kiye, ye events ko 'catch' kar lenge
redisClient.on("connect", () => {
  console.log("⚡ Redis: Connection established!");
});

redisClient.on("ready", () => {
  console.log("✅ Redis: Server is ready to handle commands.");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis: Client Error ->", err.message);
});

// Ye function ab sirf server.ts mein consistency ke liye hai
export const connectRedis = () => {
  // Isme kuch karne ki zaroorat nahi, sirf call hone par flow maintain rahega
  // Agar Redis pehle hi connect ho chuka hoga, toh ye silently skip ho jayega
};