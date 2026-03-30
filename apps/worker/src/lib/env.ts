import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  DIRECT_DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  WORKER_SECRET: z.string().min(16),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  DELHIVERY_TOKEN: z.string().optional(),
  EASYPOST_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = parseEnv();
