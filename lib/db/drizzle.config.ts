import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const isNeon = (process.env.DATABASE_URL ?? "").includes("neon.tech");

export default defineConfig({
  schema: path.resolve(__dirname, "./src/schema/index.ts").replace(/\\/g, "/"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: isNeon ? "require" : undefined,
  },
});
