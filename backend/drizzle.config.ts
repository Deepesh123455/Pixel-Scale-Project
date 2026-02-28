import {defineConfig} from "drizzle-kit"
import dotenv from "dotenv";
dotenv.config();


export default defineConfig({
    schema : "./modules/**/*.schema.ts",
    out : "./drizzle/migrations",
    dialect : "postgresql",
    dbCredentials:{
        url : process.env.DATABASE_URL as string,
    }
})