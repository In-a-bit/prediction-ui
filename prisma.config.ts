import dotenv from "dotenv";
dotenv.config({ path: ".env.development.local" });
dotenv.config(); // .env as fallback (dotenv won't overwrite existing vars)
import { defineConfig } from "prisma/config";

const isVercel = !!process.env.VERCEL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: isVercel
      ? process.env.VERCEL_PRISMA_DATABASE_URL!
      : process.env.DATABASE_URL!,
    directUrl: isVercel
      ? process.env.VERCEL_POSTGRES_URL!
      : process.env.DIRECT_URL!,
  },
});
