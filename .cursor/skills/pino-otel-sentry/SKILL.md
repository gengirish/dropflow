---
name: pino-otel-sentry
description: >-
  Observability stack for DropFlow — Pino structured logging, OpenTelemetry
  distributed tracing, Sentry error tracking. Use when adding logging,
  tracing, or error reporting to any service.
---

# Pino + OpenTelemetry + Sentry — DropFlow Observability

Packages: `pino`, `pino-pretty`, `@opentelemetry/sdk-node`, `@sentry/nextjs`, `@sentry/node`

## Pino Logger (lib/logger.ts)

```typescript
import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL ?? "info",
  transport: env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  redact: {
    paths: ["email", "phone", "buyerEmail", "buyerPhone", "*.email", "*.phone"],
    censor: "[REDACTED]",
  },
  base: {
    service: env.NODE_ENV === "production" ? "worker" : "dev",
  },
});
```

## Log Format Convention

Every log entry follows this shape:

```typescript
logger.info({
  action: "order.created",
  tenantId: "clx...",
  traceId: "abc-123",
  orderId: "clx...",
  durationMs: 42,
}, "Order created successfully");

logger.error({
  action: "payment.webhook",
  tenantId: "clx...",
  traceId: "abc-123",
  error: { code: "INVALID_SIGNATURE", message: err.message },
}, "Razorpay webhook signature verification failed");
```

Fields: `{ level, service, action, tenantId, traceId, durationMs, error? }`

## Child Loggers for Context Propagation

```typescript
export function createRequestLogger(tenantId: string, traceId: string) {
  return logger.child({ tenantId, traceId });
}

// In API route or worker job:
const log = createRequestLogger(tenantId, crypto.randomUUID());
log.info({ action: "order.list", page: 1 }, "Fetching orders");
```

## OpenTelemetry Setup (apps/worker/src/instrumentation.ts)

Must load before any application code:

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-http": { enabled: true },
      "@opentelemetry/instrumentation-express": { enabled: true },
      "@opentelemetry/instrumentation-pg": { enabled: true },
      "@opentelemetry/instrumentation-ioredis": { enabled: true },
    }),
  ],
  serviceName: "dropflow-worker",
});

sdk.start();
```

Load via Node.js `--require` flag:

```json
{
  "scripts": {
    "start": "node --require ./dist/instrumentation.js ./dist/index.js"
  }
}
```

## Sentry Setup (apps/web)

```bash
npx @sentry/wizard@latest -i nextjs
```

This creates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.

Key config:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% of requests
  environment: env.NEXT_PUBLIC_APP_ENV,
  beforeSend(event) {
    // Scrub PII
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
```

## Sentry in API Routes

```typescript
import * as Sentry from "@sentry/nextjs";

export async function POST(req: NextRequest) {
  try {
    // ... handler logic
  } catch (error) {
    Sentry.captureException(error, {
      extra: { tenantId, action: "order.create" },
    });
    return err("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
```

## Conventions

- Never `console.log` in production — always use Pino logger
- Never log PII (email, phone, address) — use Pino redaction
- Every API route and worker job: wrap in try/catch, log errors, capture in Sentry
- OpenTelemetry auto-instruments HTTP, Express, Prisma (pg), ioredis
- Sentry: set `tracesSampleRate` low in production (0.1) to control costs
- Include `tenantId` and `traceId` in every log entry for correlation
