import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  redact: {
    paths: [
      "email",
      "phone",
      "buyerEmail",
      "buyerPhone",
      "*.email",
      "*.phone",
    ],
    censor: "[REDACTED]",
  },
  base: { service: "dropflow-worker" },
});

export function createJobLogger(tenantId: string, jobId: string) {
  return logger.child({ tenantId, jobId });
}
