import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config();

// --- Configuration ---
const QUEUE_NAME = "email_queue";
const DEAD_LETTER_QUEUE = "email_queue_dlq";
const DEAD_LETTER_EXCHANGE = "email_queue_dlq_exchange";
const DEAD_LETTER_ROUTING_KEY = "deadKey";
const RECONNECT_TIMEOUT = 5000;

// --- Module State ---
// 🔥 FIX: Maine yahan 'any' laga diya hai taaki Typescript error na de
let connection: any = null;
let channel: any = null;
let isConnecting = false;

interface EmailPayload {
  email?: string;
  otp?: string;
}

/**
 * Main function to establish RabbitMQ connection.
 */
export const connectRabbitMQ = async () => {
  // 1. Singleton: Agar channel pehle se hai, wahi return karo
  if (channel) return channel;

  // 2. Prevent multiple loops
  if (isConnecting) return null;
  isConnecting = true;

  try {
    console.log("⏳ Connecting to RabbitMQ...");

    const amqpServer = process.env.RABBITMQ_URL || "amqp://localhost:5672";

    // 3. Connect
    connection = await amqp.connect(amqpServer, {
      clientProperties: { connection_name: "pixelscale-backend" },
    });

    connection.on("error", (err: any) => {
      console.error("❌ RabbitMQ Connection Error:", err);
      channel = null;
      connection = null;
    });

    connection.on("close", () => {
      console.warn("⚠️ RabbitMQ Connection closed. Retrying...");
      channel = null;
      connection = null;
      isConnecting = false;
      setTimeout(connectRabbitMQ, RECONNECT_TIMEOUT);
    });

    // 4. Create Channel
    channel = await connection.createChannel();

    // Exchange banana (Queue nahi!)
    await channel.assertExchange(DEAD_LETTER_EXCHANGE, "direct", {
      durable: true,
    });

    // DLQ Queue banana
    await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });

    // Dono ko bind karna
    await channel.bindQueue(
      DEAD_LETTER_QUEUE,
      DEAD_LETTER_EXCHANGE,
      DEAD_LETTER_ROUTING_KEY,
    );

    // Main Queue banana
    await channel.assertQueue(QUEUE_NAME, {
      durable: false,
      arguments: {
        "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
        "x-dead-letter-routing-key": DEAD_LETTER_ROUTING_KEY,
      },
    });

    console.log(`✅ RabbitMQ Connected. Queue: '${QUEUE_NAME}' is ready.`);
    isConnecting = false;

    // 🔥 FIX: Channel return karna zaroori hai worker ke liye
    return channel;
  } catch (error) {
    console.error("❌ Failed to connect to RabbitMQ:", error);
    isConnecting = false;
    channel = null;
    connection = null;
    setTimeout(connectRabbitMQ, RECONNECT_TIMEOUT);
    return null;
  }
};

/**
 * Publishes a message to the queue.
 */
export const publishToQueue = async (payload: EmailPayload) => {
  if (!channel) {
    await connectRabbitMQ();
  }

  if (!channel) {
    console.error("⚠️ Cannot publish: RabbitMQ channel is not available.");
    return false;
  }

  try {
    const buffer = Buffer.from(JSON.stringify(payload));
    const sent = channel.sendToQueue(QUEUE_NAME, buffer, { persistent: true });

    if (sent) {
      console.log(`📤 Message sent to '${QUEUE_NAME}'`);
    } else {
      console.warn("⚠️ Message sent but buffer full.");
    }
    return sent;
  } catch (error) {
    console.error("❌ Error publishing message:", error);
    return false;
  }
};

/**
 * Gracefully closes the connection.
 */
export const closeRabbitMQ = async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log("🛑 RabbitMQ connection closed gracefully.");
  } catch (error) {
    console.error("Error closing RabbitMQ:", error);
  }
};
