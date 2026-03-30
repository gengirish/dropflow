import Redis from "ioredis";
import { Queue, Worker, type Job, type WorkerOptions } from "bullmq";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

export function createQueue(name: string) {
  return new Queue(name, {
    connection: {
      host: new URL(REDIS_URL).hostname,
      port: Number(new URL(REDIS_URL).port) || 6379,
    },
  });
}

export function createWorker<T = unknown>(
  name: string,
  processor: (job: Job<T>) => Promise<void>,
  opts?: Partial<WorkerOptions>,
) {
  return new Worker<T>(name, processor, {
    connection: {
      host: new URL(REDIS_URL).hostname,
      port: Number(new URL(REDIS_URL).port) || 6379,
    },
    concurrency: 5,
    ...opts,
  });
}
