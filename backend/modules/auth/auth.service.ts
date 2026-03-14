import crypto from "crypto";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../../config/db";
import { redisClient } from "../../config/redis";
import { generateRedisKey } from "../../config/redisKey";
import { generateOtp } from "../../shared/utils/otpGenerator";
import { generateCrypto } from "../../shared/utils/crypto.utils";
import {
  generateAuthToken,
  validateRefreshToken,
} from "../../shared/utils/jwt.utils";
import { publishToQueue } from "../../shared/utils/MessageQueue";
import { emailQueue } from "../../shared/utils/BullMq";
import { ApiError } from "../../shared/utils/AppError";
import { UserTable } from "../user/user.schema";
import { AuthTable } from "../auth/auth.schema";
import { findOrCreateUser } from "../user/user.controller";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();


const OTP_EXPIRY_SECONDS = 60 * 5; // 5 Minutes
const RESEND_WAIT_SECONDS = 60; // 1 Minute
const USER_SESSION_EXPIRY = 3600; // 1 Hour (Standardized for Middleware)
const REFRESH_TOKEN_DAYS = 7; // 7 Days

/**
 * - Generates Tokens
 * - Calculates Jitter
 * - Saves Session (USER_ID) & Refresh Token (AUTH_TOKEN) to Redis in a Pipeline
 */
const initiateUserSession = async (user: any) => {
  // 1. Generate Tokens (Pure Function - No DB side effects inside)
  const { accessToken, refreshToken, hashedRefreshToken } =
    await generateAuthToken(user.id);

  // 2. Define Redis Keys
  const userSessionKey = generateRedisKey("USER_ID", user.id);
  const refreshTokenKey = generateRedisKey("AUTH_TOKEN", user.id);

  // 3. Calculate Jitter (Randomize expiry to prevent Thundering Herd)
  // 7 Days + Random (0 to 1 Day in seconds)
  const jitterSeconds = Math.floor(Math.random() * 60 * 60 * 24);
  const refreshTokenExpiry = REFRESH_TOKEN_DAYS * 24 * 60 * 60 + jitterSeconds;

  // 4. Redis Pipeline (Execute multiple commands in one go)
  const pipeline = redisClient.pipeline();

  // A. Save User Object for Middleware (Fast Access) - Expires in 1 Hour
  pipeline.set(userSessionKey, JSON.stringify(user), "EX", USER_SESSION_EXPIRY);

  // B. Save Refresh Token Hash for Security Whitelist - Expires in ~7 Days
  pipeline.set(refreshTokenKey, hashedRefreshToken, "EX", refreshTokenExpiry);

  await pipeline.exec();

  return { user, tokens: { accessToken, refreshToken } };
};

export const sendOtpService = async (email: string) => {
  if (!email) throw new ApiError("Email is required", 400);

  const key = generateRedisKey("AUTH_OTP", email);
  const existingTTL = await redisClient.ttl(key);

  if (
    existingTTL != -2 &&
    existingTTL > OTP_EXPIRY_SECONDS - RESEND_WAIT_SECONDS
  ) {
    const waitTime = existingTTL - (OTP_EXPIRY_SECONDS - RESEND_WAIT_SECONDS);
    throw new ApiError(
      `Please wait ${waitTime} seconds before requesting a new OTP.`,
      429,
    );
  }

  const otp = generateOtp();
  const hashedOtp = generateCrypto(otp);

  await redisClient.set(key, hashedOtp, "EX", OTP_EXPIRY_SECONDS);
  const isSent = await publishToQueue({ email, otp });

  if (!isSent) {
    await redisClient.del(key);
    throw new ApiError("Failed to send OTP email. Please try again.", 500);
  }

  return {
    status: "success",
    message: "OTP sent successfully",
    expiresIn: OTP_EXPIRY_SECONDS,
    resendAvailableIn: RESEND_WAIT_SECONDS,
  };
};

export const verifyOtpAndLoginService = async (email: string, otp: string) => {
  if (!email || !otp) throw new ApiError("OTP is required", 400);

  const key = generateRedisKey("AUTH_OTP", email);
  const storedOtp = await redisClient.get(key);

  if (!storedOtp)
    throw new ApiError("OTP not found or expired. Please try again.", 404);

  const hashedOtp = generateCrypto(otp);

  const bufferStored = Buffer.from(storedOtp);
  const bufferIncoming = Buffer.from(hashedOtp);

  if (bufferStored.length !== bufferIncoming.length) {
    throw new ApiError("Invalid OTP", 400);
  }

  const isMatch = crypto.timingSafeEqual(bufferStored, bufferIncoming);
  if (!isMatch) throw new ApiError("Invalid OTP", 400);

  // 1. Clean up OTP
  await redisClient.del(key);

  // 2. Find/Create User
  const user = await findOrCreateUser(email, "email_otp", null, email);
  if (!user) throw new ApiError("Failed to process user account", 500);

  // 3. Initiate Session
  return await initiateUserSession(user);
};

export const signUpService = async (email: string, password: string) => {
  const existingUser = await db.query.UserTable.findFirst({
    where: eq(UserTable.email, email),
  });

  if (existingUser) {
    const checkAuthPassword = await db.query.AuthTable.findFirst({
      where: and(
        eq(AuthTable.userId, existingUser.id),
        eq(AuthTable.provider, "email_password"),
      ),
    });
    if (checkAuthPassword) throw new ApiError("User already exists", 400);
  }

  const user = await findOrCreateUser(email, "email_password", password, email);
  return await initiateUserSession(user);
};

export const LoginViaPasswordService = async (
  email: string,
  password: string,
) => {
  if (!email || !password)
    throw new ApiError("Email and Password are required", 400);

  const existingUser = await db.query.UserTable.findFirst({
    where: eq(UserTable.email, email),
  });

  if (!existingUser) throw new ApiError("User not found", 404);

  const checkAuthPassword = await db.query.AuthTable.findFirst({
    where: and(
      eq(AuthTable.userId, existingUser.id),
      eq(AuthTable.provider, "email_password"),
    ),
  });

  if (!checkAuthPassword || !checkAuthPassword.password) {
    throw new ApiError("User not found or password not set", 404);
  }

  const isMatch = await bcrypt.compare(password, checkAuthPassword.password);
  if (!isMatch) throw new ApiError("Incorrect Password", 400);

  await db
    .update(AuthTable)
    .set({ lastLogin: new Date() })
    .where(eq(AuthTable.id, checkAuthPassword.id));

  return await initiateUserSession(existingUser);
};

export const forgotPasswordService = async (email: string) => {
  const existingUser = await db.query.AuthTable.findFirst({
    where: and(
      eq(AuthTable.providerId, email),
      eq(AuthTable.provider, "email_password"),
    ),
  });

  if (!existingUser) {
    console.log(
      `User Not Found but simulated reset password link for ${email}`,
    );
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = generateCrypto(token);
  const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  await db
    .update(AuthTable)
    .set({
      passwordResetToken: hashedToken,
      passwordResetExpires: tokenExpiry,
    })
    .where(eq(AuthTable.id, existingUser.id));

  await emailQueue.add("reset-password-job", {
    email: email,
    token: token,
  });

  console.log(`✅ Job added to queue: reset-password-job for ${email}`);
};

export const verifyResetPasswordTokenService = async (token: string) => {
  const hashedToken = generateCrypto(token);

  const existingToken = await db.query.AuthTable.findFirst({
    where: eq(AuthTable.passwordResetToken, hashedToken),
    columns: {
      id: true,
      passwordResetExpires: true,
      providerId: true,
    },
  });

  if (!existingToken) {
    throw new ApiError("Invalid or expired token", 400);
  }

  if (
    !existingToken.passwordResetExpires ||
    existingToken.passwordResetExpires < new Date()
  ) {
    throw new ApiError("Token has expired. Please request a new one.", 400);
  }

  return { valid: true, email: existingToken.providerId };
};

export const resetPasswordService = async (
  token: string,
  newPassword: string,
) => {
  const hashedToken = generateCrypto(token);

  const existingUser = await db.query.AuthTable.findFirst({
    where: and(
      eq(AuthTable.passwordResetToken, hashedToken),
      gt(AuthTable.passwordResetExpires, new Date()),
    ),
  });

  if (!existingUser) {
    throw new ApiError("Token is invalid or has expired", 400);
  }

  if (existingUser.password) {
    const isSame = await bcrypt.compare(newPassword, existingUser.password);
    if (isSame)
      throw new ApiError(
        "New password cannot be the same as the old password",
        400,
      );
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await db
    .update(AuthTable)
    .set({
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(AuthTable.id, existingUser.id));

  await emailQueue.add("security-alert", {
    email: existingUser.providerId,
    type: "password-updated",
  });

  console.log(`🔒 Password successfully reset for: ${existingUser.providerId}`);
};

export const updatePasswordService = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
) => {
  if (!currentPassword || !newPassword || !userId) {
    throw new ApiError("Current Password and New Password are required", 400);
  }

  const existingUser = await db.query.AuthTable.findFirst({
    where: and(
      eq(AuthTable.userId, userId),
      eq(AuthTable.provider, "email_password"),
    ),
  });

  if (!existingUser || !existingUser.password) {
    throw new ApiError("User not found or uses social login", 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, existingUser.password);
  if (!isMatch) throw new ApiError("Incorrect current password", 400);

  if (currentPassword === newPassword) {
    throw new ApiError(
      "New password cannot be the same as the current password",
      400,
    );
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await db
    .update(AuthTable)
    .set({
      password: hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(AuthTable.id, existingUser.id));

  // Force Logout on all devices 
  const userSessionKey = generateRedisKey("USER_ID", userId);
  const refreshTokenKey = generateRedisKey("AUTH_TOKEN", userId);

  await redisClient.del(userSessionKey);
  await redisClient.del(refreshTokenKey);

  await emailQueue.add("security-alert", {
    email: existingUser.providerId,
    type: "password-updated",
  });

  console.log(`🔒 Password updated for: ${existingUser.providerId}`);
};

export const logoutService = async (userId: string) => {
  if (!userId) {
    throw new ApiError("You are not logged in", 401);
  }

  const existingUser = await db.query.AuthTable.findFirst({
    where: eq(AuthTable.userId, userId),
  });

  // 1. Identify Keys
  const userSessionKey = generateRedisKey("USER_ID", userId);
  const refreshTokenKey = generateRedisKey("AUTH_TOKEN", userId);

  // 2. Delete Both Keys
  await redisClient.del(userSessionKey);
  await redisClient.del(refreshTokenKey);

  console.log(`👋 Logged out: ${existingUser?.providerId || userId}`);

  return { success: true };
};

const googleOauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLoginService = async (token: string) => {
  if (!token) throw new ApiError("Token not found", 400);

  try {
    const ticket = await googleOauthClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) throw new ApiError("Invalid Token", 400);

    const { email, sub: googleId, name } = payload;

    const user = await findOrCreateUser(email, "google", null, googleId);
    return await initiateUserSession(user);
  } catch (error: any) {
    console.error("❌ Google Auth Error:", error.message);
    throw new ApiError(
      "Google Authentication Failed. Token is invalid or expired.",
      401,
    );
  }
};

export const refreshAccessTokenService = async (
  incomingRefreshToken: string,
) => {
  // 1. Redis se stored hash nikalo (We need the userId first, or we check by token)
  // Note: Since we don't know the userId yet, we decode the token once first
  const decoded = jwt.decode(incomingRefreshToken) as { sub: string };
  if (!decoded?.sub) throw new ApiError("Invalid Token", 401);

  const refreshTokenKey = generateRedisKey("AUTH_TOKEN", decoded.sub);
  const storedHashedToken = await redisClient.get(refreshTokenKey);

  if (!storedHashedToken) throw new ApiError("Session expired", 401);

  // 2. Use our new utility to do the heavy lifting
  await validateRefreshToken(incomingRefreshToken, storedHashedToken);

  // 3. Database lookup
  const user = await db.query.UserTable.findFirst({
    where: eq(UserTable.id, decoded.sub),
  });

  if (!user) throw new ApiError("User not found", 404);

  // 4. New Session (Rotation)
  return await initiateUserSession(user);
};


