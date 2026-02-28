import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../../config/S3";
import dotenv from "dotenv";
dotenv.config();

/**
 * 🚀 Uploads Buffer to any specified S3 bucket
 */
export const uploadBufferToS3 = async (
  buffer: Buffer,
  bucketName: string,
  s3Key: string,
  mimeType: string,
) => {
  if (!buffer) throw new Error("File buffer is required");

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: buffer, // Seedha RAM se AWS mein push!
    ContentType: mimeType,
  });

  await s3.send(command);
};

/**
 * 🌟 Public URL generator for Previews
 * Uses AWS_S3_PUBLIC_BUCKET from .env
 */
export const uploadPreviewImage = async (
  buffer: Buffer,
  s3Key: string,
  mimeType: string,
) => {
  const publicBucket = process.env.AWS_S3_PUBLIC_BUCKET as string;

  await uploadBufferToS3(buffer, publicBucket, s3Key, mimeType);

  // Return the public S3 URL directly
  return `https://${publicBucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
};

/**
 * 🔒 Private URL generator for HD Images (5-minute expiry)
 * Uses AWS_S3_PRIVATE_BUCKET from .env
 */
export const generateHdUrl = async (s3Key: string) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_PRIVATE_BUCKET as string,
    Key: s3Key,
  });

  // 300 seconds expiry - highly secure!
  const privateUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  return privateUrl;
};
