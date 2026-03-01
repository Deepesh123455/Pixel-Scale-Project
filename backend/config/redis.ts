import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();


export const redisClient = new Redis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: null,
  tls: {
    rejectUnauthorized: false, 
  },
});


redisClient.on("connect", () => {
  console.log("⚡ Redis: Connection established!");
});

redisClient.on("ready", () => {
  console.log("✅ Redis: Server is ready to handle commands.");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis: Client Error ->", err.message);
});


export const connectRedis = () => {
 
};