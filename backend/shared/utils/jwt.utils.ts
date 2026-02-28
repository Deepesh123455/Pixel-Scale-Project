import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { ApiError } from "../../shared/utils/AppError"; // Check path
import dotenv from "dotenv";
import { generateCrypto } from "../../shared/utils/crypto.utils"; // Check path
import crypto from "crypto";

dotenv.config();

interface CustomPayload extends JwtPayload {
  sub: string;
}

export const generateToken = (
  userId: string,
  secret: string,
  expiresIn: string | number,
): string => {
  const payload: CustomPayload = {
    sub: userId,
  };

  try {
    return jwt.sign(payload, secret, {
      expiresIn: expiresIn as SignOptions["expiresIn"],
    });
  } catch (error) {
    throw new ApiError("Failed to generate token", 500);
  }
};

export const generateAuthToken = async (userId: string) => {
  // 1. Generate Access Token
  const accessToken = generateToken(
    userId,
    process.env.JWT_ACCESS_SECRET!,
    process.env.JWT_ACCESS_EXPIRY || "15m",
  );

  // 2. Generate Refresh Token
  const refreshToken = generateToken(
    userId,
    process.env.JWT_REFRESH_SECRET!,
    process.env.JWT_REFRESH_EXPIRY || "7d",
  );

  // 3. Hash it (Security Best Practice)
  const hashedRefreshToken = generateCrypto(refreshToken);

  // 4. Return tokens AND the hash.
  // Let the Service decide where to save the hash (Redis/DB).
  return { accessToken, refreshToken, hashedRefreshToken };
};

// ... inside your jwt utility file

/**
 * 🛠️ Validates the refresh token signature and compares it against the stored hash
 */
export const validateRefreshToken = async (
  incomingToken: string,
  storedHashedToken: string,
) => {
  // 1. Verify Signature & Expiry
  let decoded: CustomPayload;
  try {
    decoded = jwt.verify(
      incomingToken,
      process.env.JWT_REFRESH_SECRET!,
    ) as CustomPayload;
  } catch (error) {
    throw new ApiError("Refresh token expired or invalid", 401);
  }

  // 2. Hash Comparison (Security check)
  const hashedIncoming = generateCrypto(incomingToken);

  const bufferStored = Buffer.from(storedHashedToken);
  const bufferIncoming = Buffer.from(hashedIncoming);

  const isMatch =
    bufferStored.length === bufferIncoming.length &&
    crypto.timingSafeEqual(bufferStored, bufferIncoming);

  if (!isMatch) {
    throw new ApiError("Invalid refresh token session", 401);
  }

  return decoded; // Return decoded payload (contains 'sub'/userId)
};
