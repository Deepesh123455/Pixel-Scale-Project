import { Worker, Job } from "bullmq";
import { redisClient } from "../config/redis";
import { EMAIL_QUEUE_NAME } from "../shared/utils/BullMq";
import { sendResetPasswordEmail, sendPasswordUpdatedEmail } from "../modules/auth/auth.email"; // 👈 New import needed

// 1. Types Define karo (Union Type for flexibility)
interface ResetJobData {
  email: string;
  token: string;
}

interface SecurityAlertJobData {
  email: string;
  type: "password-updated";
}

// Worker ab kisi bhi tarah ka data le sakta hai
type JobData = ResetJobData | SecurityAlertJobData;

export const resendWorker = new Worker<JobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<JobData>) => {
    
    console.log(`🚀 Picked up Job: ${job.name} (ID: ${job.id})`);

    try {
      // 🔍 SWITCH LOGIC: Job Name ke hisaab se kaam karo
      switch (job.name) {
        
        // CASE 1: Purana Logic (Reset Password)
        case "reset-password-job": {
          const data = job.data as ResetJobData;
          console.log(`📨 Sending Reset Password Link to: ${data.email}`);

          if (!data.email || !data.token) {
            console.error(`❌ Missing Data for Job ${job.id}`);
            return; // Unrecoverable
          }

          const success = await sendResetPasswordEmail(data.email, data.token);
          if (!success) throw new Error("Email Service Failed");
          break;
        }

        // CASE 2: Naya Feature (Security Alert)
        case "security-alert": {
          const data = job.data as SecurityAlertJobData;
          console.log(`🛡️ Sending Security Alert (${data.type}) to: ${data.email}`);

          if (!data.email) {
            console.error(`❌ Missing Email for Job ${job.id}`);
            return;
          }

          // Check karo alert type kya hai (future proofing)
          if (data.type === "password-updated") {
             // ⚠️ Tumhe ye function auth.email.ts mein banana padega (Neeche code hai)
             const success = await sendPasswordUpdatedEmail(data.email);
             if (!success) throw new Error("Email Service Failed");
          }
          break;
        }

        // DEFAULT: Unknown Job
        default:
          console.warn(`⚠️ Ignoring unknown job type: ${job.name}`);
          return;
      }

      console.log(`✅ Job ${job.id} (${job.name}) Completed!`);
      return { success: true };

    } catch (err: any) {
      console.error(`❌ Job ${job.id} Failed: ${err.message}`);
      throw err; // Retry trigger karega
    }
  },
  {
    connection: redisClient as any,
    concurrency: 5,
  }
);

console.log("🐂 BullMQ Worker initialized and listening...");