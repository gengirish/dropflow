import { startOrderWorker } from "./workers/order-worker";
import { startAnalyticsWorker } from "./workers/analytics-worker";
import { startNotificationWorker } from "./workers/notification-worker";
import express from "express";
import cors from "cors";
import { logger } from "./lib/logger";
import { allQueues } from "./queues";
import { addSSEClient } from "./sse/broadcaster";
import { QUEUE_NAMES } from "@dropflow/config";
import { EnqueueJobInput } from "@dropflow/types";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3001;
const WORKER_SECRET = process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = req.headers["x-worker-secret"];
  if (secret !== WORKER_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

app.get("/health", async (_req, res) => {
  const queueStats = await Promise.all(
    Object.entries(allQueues).map(async ([name, queue]) => {
      const counts = await queue.getJobCounts();
      return { name, ...counts };
    }),
  );

  res.json({ status: "ok", queues: queueStats });
});

app.post("/internal/enqueue", authMiddleware, async (req, res) => {
  try {
    const input = EnqueueJobInput.parse(req.body);
    const queue = allQueues[input.queue as keyof typeof allQueues];

    if (!queue) {
      res.status(400).json({ error: `Unknown queue: ${input.queue}` });
      return;
    }

    const bullJobName = input.jobName ?? input.queue;
    const job = await queue.add(bullJobName, input.payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      ...input.options,
    });

    logger.info(
      { queue: input.queue, jobName: bullJobName, jobId: job.id },
      "Job enqueued",
    );
    res.json({ jobId: job.id });
  } catch (error) {
    logger.error({ error }, "Failed to enqueue job");
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
  }
});

app.get("/sse/:tenantId", authMiddleware, async (req, res) => {
  const tenantId = req.params.tenantId;
  if (!tenantId || Array.isArray(tenantId)) {
    res.status(400).json({ error: "tenantId required" });
    return;
  }
  await addSSEClient(tenantId, req, res);
});

startOrderWorker();
startAnalyticsWorker();
startNotificationWorker();

app.listen(PORT, () => {
  logger.info({ port: PORT }, "DropFlow worker started");
});

async function shutdown() {
  logger.info("Shutting down gracefully...");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
