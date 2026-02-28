// src/modules/image/image.queue.ts
import { Queue,QueueEvents } from "bullmq";
import { redisClient } from "../../config/redis";

// Queue initialization with Upstash Redis connection

const QUEUE_NAME = "image_processing_queue";
const JOB_NAME = "process_image";
export const imageQueue = new Queue(QUEUE_NAME, {
  connection: redisClient as any,
  defaultJobOptions: {
    attempts: 3, // Agar sharp fail ho, toh automatically 3 baar retry karega
    backoff: {
      type: "exponential",
      delay: 1000, // Retries ke beech delay: 1s, 2s, 4s...
    },
    removeOnComplete: true, // 🌟 Upstash ki memory aur paise bachane ka masterstroke
    removeOnFail: false, // Failed jobs ko debug karne ke liye Redis mein rakhenge
  },
});

export const imageQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisClient as any,
});

// Pure function jo controller call karega
export const addImageProcessingJob = async (jobId: string, payload: any) => {
  // 'process_image' job ka naam hai
  const job = await imageQueue.add(JOB_NAME, payload, { jobId });
  return job.id;
};
