import { app } from "./app";
import http from "http";
import { connectDB } from "./config/db";
import { connectRabbitMQ, closeRabbitMQ } from "./shared/utils/MessageQueue"
import { redisClient, connectRedis } from "./config/redis";
import dotenv from "dotenv";
import { resendWorker } from "./workers/email.worker";
import { imageWorker } from "./modules/imageProcessing/image.worker";
dotenv.config();

process.on("uncaughtException", (err: Error) => {
  console.error("Uncaught Exception, shutting down...");
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

const httpServer = http.createServer(app);

const bootSequence = async () => {
  try {
    console.log("initializing the pixelScale InfraStrucutre");
    await connectDB();
    await connectRedis();
    await connectRabbitMQ();
    

    const PORT = Number(process.env.PORT) || 4500;
    httpServer.listen(PORT, () => {
      console.log(
        `Http server is ruuning on the port ${PORT} and in the ${process.env.NODE_ENV} mode`,
      );
      console.log(
        "✅ All Systems Go! PixelScale is Ready for REST & WebSockets.",
      );
    });
  } catch (err) {
    console.error("failed to setup the pixel Scale", err);
    process.exit(1);
  }
};

bootSequence();

process.on("unhandledRejection", (error: Error) => {
  console.error("Unhandled Rejection shutting down");
  console.error("error", error.name, error.message, error.stack);
  if (httpServer.listening) {
    httpServer.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  console.log("👋 SIGTERM received, shutting down gracefully");
  if (httpServer.listening) {
    httpServer.close(async () => {
      console.log("http server closed");
      try {
        console.log("closing the bull mq");
        await resendWorker.close();
        await imageWorker.close();
        if (redisClient) await redisClient.quit();
        await closeRabbitMQ();
        console.log("All the Infra Of Pixel Scale Got Closed");
        process.exit(0);
      } catch (err) {
        console.error("failed to close the pixel Scale", err);
        process.exit(1);
      }
    });
  }
});

process.on("SIGINT", async () => {
    console.log("👋 SIGINT received, shutting down gracefully");
    if (httpServer.listening) {
      httpServer.close(async () => {
        console.log("http server closed");
        try {
          console.log("trying to close the bull mq");
          await resendWorker.close();
          if (redisClient) await redisClient.quit();
          await closeRabbitMQ();
          await imageWorker.close();
          console.log("All the Infra Of Pixel Scale Got Closed");
          process.exit(0);
        } catch (err) {
          console.error("failed to close the pixel Scale", err);
          process.exit(1);
        }
      });
    }
})


