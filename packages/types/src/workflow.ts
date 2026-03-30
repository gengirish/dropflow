import { z } from "zod";

export const WorkflowConfigInput = z.object({
  configJson: z.record(z.unknown()),
});
export type WorkflowConfigInput = z.infer<typeof WorkflowConfigInput>;

export const WorkflowRunFilters = z.object({
  status: z.enum(["RUNNING", "COMPLETED", "FAILED", "PAUSED", "CANCELLED"]).optional(),
  triggerId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type WorkflowRunFilters = z.infer<typeof WorkflowRunFilters>;

export const EnqueueJobInput = z.object({
  queue: z.enum(["order-queue", "inventory-queue", "invoice-queue", "shipping-queue"]),
  payload: z.record(z.unknown()),
  options: z.object({
    delay: z.number().int().nonnegative().optional(),
    priority: z.number().int().optional(),
  }).optional(),
});
export type EnqueueJobInput = z.infer<typeof EnqueueJobInput>;
