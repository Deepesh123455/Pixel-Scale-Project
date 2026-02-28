import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import dotenv from "dotenv";
import * as schema from "../modules/schema";

dotenv.config();

const connectionString = process.env.DATABASE_URL as string;

// 1. 🏎️ Prepare the Connection Client (postgres-js)
// Isme max connections aur idle timeout yahan handle hote hain
const client = postgres(connectionString, {
  max: 20,
  idle_timeout: 30, // 30 seconds
  connect_timeout: 10, // 10 seconds
});

// 2. ✨ Initialize Drizzle with the postgres client
export const db = drizzle(client,{schema : schema});

// 3. ✅ Health Check Function for server.ts
export const connectDB = async () => {
  try {
    // postgres-js mein connection check karne ke liye hum ek simple query run karte hain
    await client`SELECT 1`;
    console.log("🐘 Database connected successfully via postgres-js");
  } catch (error) {
    console.error("🚨 Supabase Connection Failed:", error);
    process.exit(1);
  }
};
