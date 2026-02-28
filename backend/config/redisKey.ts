// src/config/redisKeys.ts

// 1. Saare prefixes yahan define karenge
export const REDIS_PREFIXES = {
  // 🔐 Auth Module
  AUTH_OTP: "auth:otp:", // Login/Signup OTP ke liye
  AUTH_TOKEN: "auth:token:", // Active sessions track karne ke liye
  AUTH_RESET_TOKEN: "auth:reset_token:", // Password reset links ke liye (Jo tumne pucha)

  // User Set
  USER_ID: "user:id:", // User ID ke liye
  // 🛡️ Security / Rate Limiting
  RATE_LIMIT_IP: "rate_limit:ip:", // Spam rokne ke liye
  RATE_LIMIT_EMAIL: "rate_limit:email:", // Ek email pe baar-baar OTP rokne ke liye

  // 🖼️ PixelScale Core Features (Image Engine)
  IMAGE_PREVIEW: "image:preview:", // Preview image ke URLs (Low res)
  IMAGE_HD_CACHE: "image:hd:cache:", // 🔥 Tumhara idea: 10 min instant download cache
  IMAGE_JOB_STATUS: "image:job:status:", // BullMQ/RabbitMQ processing ka status check karne ke liye
} as const;

// 2. TypeScript Magic: Ye ensure karega ki hum inke alawa koi galat string pass na karein
export type RedisPrefix = keyof typeof REDIS_PREFIXES;

// 3. The Helper Function
export const generateRedisKey = (
  prefix: RedisPrefix,
  identifier: string,
): string => {
  return `${REDIS_PREFIXES[prefix]}${identifier}`;
};
