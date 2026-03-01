import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import dotenv from "dotenv";
import * as schema from "../modules/schema";

dotenv.config();

const connectionString = process.env.DATABASE_URL as string;


const client = postgres(connectionString, {
  max: 20,
  idle_timeout: 30, 
  connect_timeout: 10, 
});


export const db = drizzle(client,{schema : schema});


export const connectDB = async () => {
  try {
    
    await client`SELECT 1`;
    console.log("🐘 Database connected successfully via postgres-js");
  } catch (error) {
    console.error("🚨 Supabase Connection Failed:", error);
    process.exit(1);
  }
};
