import { ConsumeMessage } from "amqplib"; // ✅ Import the message type
import { connectRabbitMQ } from "../../shared/utils/MessageQueue";
import { sendOTPEmail } from "./auth.email";
import dotenv from "dotenv";

dotenv.config();

// Ye tumhara apna interface hai (Payload ke liye)
interface EmailPayloadData {
  email: string;
  otp: string;
}

const QUEUE_NAME = "email_queue";

const startWorker = async () => {
  try {
    const channel = await connectRabbitMQ();

    if (!channel) {
      console.error("❌ Channel not available");
      return;
    }

    await channel.prefetch(1);
    console.log("👷 Notification Worker Ready");

    // ✅ msg ka type 'ConsumeMessage | null' hota hai
    channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
      if (!msg) {
        console.error("⚠️ Consumer cancelled.");
        return;
      }

      try {
        // ✅ msg.content Buffer hai, usko string bana ke parse karo
        const rawContent = msg.content.toString();
        const data = JSON.parse(rawContent) as EmailPayloadData; // Type assertion

        if (!data.email || !data.otp) {
          console.error("❌ Invalid Payload", data);
          channel.ack(msg); // Ack bad data to avoid loop
          return;
        }

        console.log(`📨 Sending OTP to ${data.email}...`);
        await sendOTPEmail(data.email, data.otp);

        channel.ack(msg);
        console.log("✅ Job Done & Acked");
      } catch (err) {
        console.error("❌ Error processing message:", err);
        // Error aaya toh message ko wapas queue mein nahi dalenge (Ack kar denge)
        // taki infinite loop na bane. (Ideally DLQ mein jana chahiye)
        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.log("❌ Failed to start the worker", err);
  }
};

startWorker();
