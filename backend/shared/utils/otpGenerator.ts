import { randomInt } from "node:crypto";

export const generateOtp = (length: number = 6 ) => {
  const max = Math.pow(10, length);
  const otp = randomInt(max);

  return otp.toString().padStart(length, "0");
};
