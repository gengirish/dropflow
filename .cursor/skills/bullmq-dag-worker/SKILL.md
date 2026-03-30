---
name: bullmq-dag-worker
description: >-
  BullMQ queues, Flows (DAG), ioredis, and bull-board patterns for the DropFlow
  worker service on Fly.io. Use when creating queues, workers, job processors,
  DAG workflows, or queue monitoring in apps/worker/.
---

# BullMQ + DAG Worker — DropFlow

Packages: `bullmq`, `ioredis`, `@bull-board/express`  
Location: `apps/worker/`

## Redis Client (lib/redis.ts)

```typescript
import Redis from "ioredis";
import { env } from "./env";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
```

## Queue Factory (lib/redis.ts)

```typescript
import { Queue, Worker, QueueEvents } from "bullmq";

export function createQueue(name: string) {
  return new Queue(name, { connection: redis });
}

export function createWorker(
  name: string,
  processor: (job: Job) => Promise<void>,
  opts?: Partial<WorkerOptions>,
) {
  return new Worker(name, processor, {
    connection: redis,
    concurrency: 5,
    ...opts,
  });
}
```

## Queue Definitions

Four queues, each with retry + dead-letter:

```typescript
const QUEUE_CONFIG = {
  "order-queue": { concurrency: 5, retries: 3 },
  "inventory-queue": { concurrency: 5, retries: 3 },
  "invoice-queue": { concurrency: 3, retries: 3 },
  "shipping-queue": { concurrency: 5, retries: 3 },
} as const;

export const queues = Object.fromEntries(
  Object.keys(QUEUE_CONFIG).map((name) => [name, createQueue(name)])
);
```

## Worker Implementation

File: `workers/order-worker.ts`

```typescript
import { Job } from "bullmq";
import { createWorker } from "../lib/redis";
import { OrderJobPayload } from "@dropflow/types";
import { runWorkflow } from "../dag/executor";
import { broadcast } from "../sse/broadcaster";

export const orderWorker = createWorker("order-queue", async (job: Job) => {
  const payload = OrderJobPayload.parse(job.data);

  for await (const step of runWorkflow("order-fulfillment", {
    tenantId: payload.tenantId,
    triggerId: payload.orderId,
    workflowRunId: job.id!,
  })) {
    broadcast(payload.tenantId, {
      type: "WORKFLOW_STEP",
      workflowRunId: job.id!,
      step: step.id,
      status: step.status,
      data: step.output,
    });
  }
}, {
  concurrency: 5,
});

orderWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Order job failed");
  if (job) {
    broadcast(job.data.tenantId, {
      type: "WORKFLOW_STEP",
      workflowRunId: job.id!,
      step: "unknown",
      status: "FAILED",
    });
  }
});
```

## BullMQ Flows (DAG)

Use FlowProducer for parent-child job dependencies:

```typescript
import { FlowProducer } from "bullmq";

const flowProducer = new FlowProducer({ connection: redis });

const flow = await flowProducer.add({
  name: "complete-order",
  queueName: "order-queue",
  data: { orderId, tenantId },
  children: [
    {
      name: "generate-invoice",
      queueName: "invoice-queue",
      data: { orderId, tenantId },
    },
    {
      name: "create-shipment",
      queueName: "shipping-queue",
      data: { orderId, tenantId },
    },
  ],
});
```

Parent job waits for all children to complete. Access child results:

```typescript
const childValues = await job.getChildrenValues();
```

## DAG Executor (dag/executor.ts)

```typescript
export async function* runWorkflow(
  workflowId: string,
  context: WorkflowContext,
): AsyncGenerator<StepResult> {
  const definition = await loadWorkflowDefinition(workflowId, context.tenantId);
  const steps = topologicalSort(definition.dagJson);

  for (const step of steps) {
    const stepFn = getStepImplementation(step.type);
    const output = await stepFn(context);

    await prisma.workflowRun.update({
      where: { id: context.workflowRunId },
      data: {
        currentStep: step.id,
        auditLog: { push: { stepId: step.id, status: "completed", output, completedAt: new Date() } },
      },
    });

    yield { id: step.id, status: "completed", output };
  }
}
```

## Bull-Board Dashboard

```typescript
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: Object.values(queues).map((q) => new BullMQAdapter(q)),
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());
```

## Job Options Defaults

```typescript
const defaultJobOpts = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};
```

## Graceful Shutdown

```typescript
async function shutdown() {
  await Promise.all([
    orderWorker.close(),
    inventoryWorker.close(),
    invoiceWorker.close(),
    shippingWorker.close(),
  ]);
  await redis.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```
