import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../../config/db";
import { ImageTable } from "./image.schema";
import { addImageProcessingJob } from "./image.queue";
import { ApiError } from "../../shared/utils/AppError";

// Utilities & Configs
import { uploadBufferToS3, generateHdUrl } from "../../shared/utils/s3.util";
import { redisClient } from "../../config/redis";
import { generateRedisKey } from "../../config/redisKey";

// ============================================================================
// 📤 1. UPLOAD SERVICE (Raw Ingestion to Private Vault)
// ============================================================================
export const uploadImageService = async (
  userId: string | undefined,
  guestId: string | undefined,
  file: Express.Multer.File,
  operations: string[],
  resizeParams?: { width?: number; height?: number },
) => {
  const imageId = uuidv4();
  const folderName = userId ? `users/${userId}` : `guests/${guestId}`;

  const rawS3Key = `raw/${folderName}/${imageId}-${file.originalname}`;
  const previewS3Key = `previews/${folderName}/${imageId}.webp`;
  const hdS3Key = `hd/${folderName}/${imageId}.webp`;

  try {
    await uploadBufferToS3(
      file.buffer,
      process.env.AWS_S3_PRIVATE_BUCKET as string,
      rawS3Key,
      file.mimetype,
    );
  } catch (error) {
    console.error("❌ S3 Upload Error:", error);
    throw new ApiError("Failed to securely vault the raw image.", 500);
  }

  const [newImage] = await db
    .insert(ImageTable)
    .values({
      id: imageId,
      user_id: userId || null,
      guest_id: guestId || null,
      originalName: file.originalname,
      operationsUsed: operations,
      previewS3Key: previewS3Key,
      hdS3Key: hdS3Key,
      size: Math.round(file.size / 1024),
      status: "pending",
    })
    .returning();

  await addImageProcessingJob(newImage.id, {
    imageId: newImage.id,
    rawS3Key,
    previewS3Key,
    hdS3Key,
    operations,
    resizeParams,
  });

  return newImage;
};

// ============================================================================
// 🌍 2. GET PREVIEW & METADATA (For UI rendering - Public)
// ============================================================================
// ============================================================================
// 🌍 2. GET PREVIEW & METADATA (For UI rendering - Public but Ownership Aware)
// ============================================================================
export const getImageDetailService = async (
  imageId: string,
  userId?: string,
  guestId?: string,
) => {
  const cacheKey = generateRedisKey("IMAGE_JOB_STATUS", imageId);
  let imageData: any;

  // 🚀 STEP 1: Check Cache
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    imageData = JSON.parse(cachedData);
  } else {
    // 🚀 STEP 2: Cache miss? DB se laao
    const [dbImage] = await db
      .select()
      .from(ImageTable)
      .where(eq(ImageTable.id, imageId as string));
    if (!dbImage) throw new ApiError("Image not found in the vault", 404);

    if (dbImage.status !== "completed") {
      return { status: dbImage.status, message: "Processing..." };
    }

    // 🚀 STEP 3: Create Object for Cache
    const publicBucket = process.env.AWS_S3_PUBLIC_BUCKET;
    const region = process.env.AWS_REGION;
    const previewUrl = `https://${publicBucket}.s3.${region}.amazonaws.com/${dbImage.previewS3Key}`;

    imageData = {
      id: dbImage.id,
      status: dbImage.status,
      originalName: dbImage.originalName,
      sizeKb: dbImage.size,
      operationsUsed: dbImage.operationsUsed,
      previewUrl,
      user_id: dbImage.user_id, // 👈 Backend tracking ke liye (Cache mein jayega)
      guest_id: dbImage.guest_id, // 👈 Backend tracking ke liye (Cache mein jayega)
    };

    // 🚀 STEP 4: Save to Cache (1 Hour)
    await redisClient.set(cacheKey, JSON.stringify(imageData), "EX", 3600);
  }

  // 🚀 STEP 5: Flexible Ownership Logic (On the fly, NEVER cached)
  const isOwner = Boolean(
    (userId && imageData.user_id === userId) ||
    (guestId && imageData.guest_id === guestId),
  );

  // Return clean data to frontend (DB IDs hide kardi hain security ke liye)
  return {
    id: imageData.id,
    status: imageData.status,
    originalName: imageData.originalName,
    sizeKb: imageData.sizeKb,
    operationsUsed: imageData.operationsUsed,
    previewUrl: imageData.previewUrl,
    isOwner, // 👈 Frontend is boolean se UI control karega!
  };
};

// ============================================================================
// 🔒 3. GET HD DOWNLOAD URL (Strict Auth Check & On-Demand Generation)
// ============================================================================
export const getHdDownloadUrlService = async (
  imageId: string,
  userId?: string, // Optional from controller, but strictly checked inside
  guestId?: string,
) => {
  // 🚀 STEP 1: STRICT AUTH WALL (Tumhara Logic)
  // Sabse pehle user check karo. Guest ko HD download allowed nahi hai!
  if (!userId) {
    throw new ApiError(
      "Please Login or Sign Up to download the HD version of this image.",
      401, // 401 Unauthorized = Frontend seedha Login modal open karega
    );
  }

  // 🚀 STEP 2: Fetch validation data (From Redis or DB)
  const cacheKey = generateRedisKey("IMAGE_JOB_STATUS", imageId);
  const cachedData = await redisClient.get(cacheKey);

  let image;
  if (cachedData) {
    image = JSON.parse(cachedData);
  } else {
    const [dbImage] = await db
      .select()
      .from(ImageTable)
      .where(eq(ImageTable.id, imageId as string));

    image = dbImage;
  }

  if (!image) throw new ApiError("Image not found", 404);
  if (image.status !== "completed")
    throw new ApiError("HD Image is not ready yet", 400);

  // 🚀 STEP 3: STRICT OWNERSHIP CHECK
  // Condition 1: Image already user ke naam ho chuki hai (Via /claim API)
  const isUserOwner = image.user_id === userId;

  // Condition 2: Image abhi tak guest ke naam pe hai, par logged-in user wahi guest_id bhej raha hai
  // (Yeh check isliye taaki login ke turant baad, claim hone se pehle bhi download fail na ho)
  const isGuestOwner = guestId && image.guest_id === guestId && !image.user_id;

  if (!isUserOwner && !isGuestOwner) {
    throw new ApiError(
      "Unauthorized. You do not have permission to download this image.",
      403, // 403 Forbidden = Login toh hai, par image teri nahi hai
    );
  }

  // 🚀 STEP 4: Generate Fresh Presigned URL (Locally signed, 0ms latency)
  const hdUrl = await generateHdUrl(image.hdS3Key);

  return hdUrl;
};
// ============================================================================
// 🔄 4. CLAIM GUEST IMAGES (PLG - Guest to User Sync)
// ============================================================================
export const claimGuestImagesService = async (
  userId: string,
  guestId: string,
) => {
  if (!guestId) throw new ApiError("Guest ID is required to claim images", 400);

  const result = await db
    .update(ImageTable)
    .set({ user_id: userId, guest_id: null })
    .where(eq(ImageTable.guest_id, guestId))
    .returning({ id: ImageTable.id });

  return result.length;
};
