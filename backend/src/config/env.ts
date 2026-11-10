import "dotenv/config";
import { z } from "zod";

// Fail fast at startup if config is missing/invalid.
const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
});

export const env = schema.parse(process.env);
