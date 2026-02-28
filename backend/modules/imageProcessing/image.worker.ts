import { Worker, Job } from "bullmq";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { s3 } from "../../config/S3";
import { db } from "../../config/db";
import { ImageTable } from "./image.schema";
import { redisClient } from "../../config/redis";

// Apni custom utilities
import {
  uploadBufferToS3,
  uploadPreviewImage,
} from "../../shared/utils/s3.util";
import { generateRedisKey } from "../../config/redisKey";

// S3 stream ko Buffer mein convert karne ka helper
const streamToBuffer = async (stream: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
};

// Queue configuration
const QUEUE_NAME = "image_processing_queue";

export const imageWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const {
      imageId,
      rawS3Key,
      previewS3Key,
      hdS3Key,
      operations,
      resizeParams,
    } = job.data;

    console.log(`🚀 Job [${job.id}] Started: Processing Image ${imageId}`);

    try {
      // 1. DB mein status 'processing' mark karo
      await db
        .update(ImageTable)
        .set({ status: "processing" })
        .where(eq(ImageTable.id, imageId));

      // 2. AWS S3 se Raw file download karo
      const getObjectParams = {
        Bucket: process.env.AWS_S3_PRIVATE_BUCKET as string,
        Key: rawS3Key,
      };
      const { Body } = await s3.send(new GetObjectCommand(getObjectParams));
      const rawBuffer = await streamToBuffer(Body);

      // 3. 🪄 SHARP MAGIC: HD Image Processing
      let hdSharpInstance = sharp(rawBuffer);

      if (resizeParams?.width || resizeParams?.height) {
        hdSharpInstance = hdSharpInstance.resize({
          width: resizeParams.width,
          height: resizeParams.height,
          fit: "cover",
          position: "attention",
        });
      }

      if (operations?.includes("grayscale")) {
        hdSharpInstance = hdSharpInstance.grayscale();
      }

      const hdBuffer = await hdSharpInstance
        .webp({ quality: 85, effort: 6 })
        .toBuffer();

      // 4. 🪄 SHARP MAGIC: Preview Image Processing (FIXED BLUR LOGIC)
      let previewSharpInstance = sharp(rawBuffer).resize({ width: 400 });

      // ✅ FIX: .blur() tabhi call hoga jab operation array mein 'blur' hoga.
      // 0 pass karne par Sharp crash ho jata hai.
      if (operations?.includes("blur")) {
        previewSharpInstance = previewSharpInstance.blur(5);
      }

      const previewBuffer = await previewSharpInstance
        .webp({ quality: 50 })
        .toBuffer();

      // 5. S3 mein dono processed files upload karo
      await Promise.all([
        uploadBufferToS3(
          hdBuffer,
          process.env.AWS_S3_PRIVATE_BUCKET as string,
          hdS3Key,
          "image/webp",
        ),
        uploadPreviewImage(previewBuffer, previewS3Key, "image/webp"),
      ]);

      // 6. Database mein status 'completed' mark karo
      await db
        .update(ImageTable)
        .set({ status: "completed" })
        .where(eq(ImageTable.id, imageId));

      // 🧹 REDIS CACHE INVALIDATION
      await redisClient.del(generateRedisKey("IMAGE_JOB_STATUS", imageId));

      console.log(`✅ Job [${job.id}] Completed: Assets saved to S3!`);

      return { success: true, imageId };
    } catch (error) {
      console.error(`❌ Job [${job.id}] Failed:`, error);

      // Fail hone par DB update karo
      await db
        .update(ImageTable)
        .set({ status: "failed" })
        .where(eq(ImageTable.id, imageId));

      // Cache invalidate karo taaki error reflect ho
      await redisClient.del(generateRedisKey("IMAGE_JOB_STATUS", imageId));

      throw error;
    }
  },
  {
    connection: redisClient as any,
    concurrency: 5,
  },
);

console.log(
  "✅ Image BullMQ Worker has been started and is listening for jobs...",
);

imageWorker.on("completed", (job) => {
  console.log(`Worker locally completed job ${job.id}`);
});

imageWorker.on("failed", (job, err) => {
  console.log(
    `Worker locally failed job ${job?.id} with error: ${err.message}`,
  );
});
