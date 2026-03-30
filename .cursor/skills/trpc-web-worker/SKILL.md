---
name: trpc-web-worker
description: >-
  tRPC typed API between apps/web (Vercel) and apps/worker (Fly.io). Use when
  creating tRPC routers, adding procedures, or calling the worker from the web
  app.
---

# tRPC — Web ↔ Worker Communication

Package: `@trpc/server`, `@trpc/client`

## Worker-Side Router (apps/worker/src/trpc/router.ts)

```typescript
import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.context<{ tenantId: string }>().create();

export const appRouter = t.router({
  enqueue: t.procedure
    .input(z.object({
      queue: z.enum(["order-queue", "inventory-queue", "invoice-queue", "shipping-queue"]),
      payload: z.record(z.unknown()),
      options: z.object({
        delay: z.number().optional(),
        priority: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const queue = getQueue(input.queue);
      const job = await queue.add(input.queue, {
        ...input.payload,
        tenantId: ctx.tenantId,
      }, input.options);
      return { jobId: job.id };
    }),

  workflowRun: t.procedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ input }) => {
      return await prisma.workflowRun.findUnique({
        where: { id: input.runId },
      });
    }),

  health: t.procedure.query(async () => {
    const queues = await getQueueStats();
    return { status: "ok", queues };
  }),
});

export type AppRouter = typeof appRouter;
```

## Worker Express Mount (apps/worker/src/index.ts)

```typescript
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./trpc/router";

app.use("/trpc", createExpressMiddleware({
  router: appRouter,
  createContext: ({ req }) => ({
    tenantId: req.headers["x-tenant-id"] as string,
  }),
}));
```

## Web-Side Client (apps/web/lib/trpc/client.ts)

```typescript
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "worker/src/trpc/router";
import { env } from "@/lib/env";

export const workerClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.FLY_WORKER_URL}/trpc`,
      headers: () => ({
        "x-worker-secret": env.WORKER_SECRET,
      }),
    }),
  ],
});
```

## Usage in Web API Routes / Server Actions

```typescript
const { jobId } = await workerClient.enqueue.mutate({
  queue: "order-queue",
  payload: { orderId: order.id, tenantId },
});
```

## Auth Between Services

- Web → Worker calls authenticated via `WORKER_SECRET` shared secret
- Worker verifies `x-worker-secret` header matches env
- tRPC context extracts `x-tenant-id` from headers for tenant scoping
