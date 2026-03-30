import type { Job } from "bullmq";
import { prisma, Prisma } from "@dropflow/db";
import { createWorker } from "../lib/redis";
import { QUEUE_NAMES } from "@dropflow/config";
import { executeWorkflow } from "../dag/executor";
import { ORDER_FULFILLMENT_DAG } from "../dag/default-workflows";
import { logger } from "../lib/logger";
import type { DAGDefinition } from "../dag/types";

interface OrderJobPayload {
  tenantId: string;
  orderId: string;
}

async function processOrderJob(job: Job<OrderJobPayload>) {
  const { tenantId, orderId } = job.data;
  const log = logger.child({ tenantId, orderId, jobId: job.id });

  log.info("Processing order job");

  const workflowDef = await prisma.workflowDefinition.findFirst({
    where: { tenantId, trigger: "order.created", status: "ACTIVE" },
    orderBy: { version: "desc" },
  });

  const dag: DAGDefinition = workflowDef
    ? (workflowDef.dagJson as unknown as DAGDefinition)
    : ORDER_FULFILLMENT_DAG;

  let workflowDefRecord = workflowDef;
  if (!workflowDefRecord) {
    workflowDefRecord = await prisma.workflowDefinition.upsert({
      where: {
        tenantId_name_version: {
          tenantId,
          name: "Order Fulfillment",
          version: 1,
        },
      },
      create: {
        tenantId,
        name: "Order Fulfillment",
        trigger: "order.created",
        dagJson: ORDER_FULFILLMENT_DAG as unknown as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  const workflowRun = await prisma.workflowRun.create({
    data: {
      workflowDefinitionId: workflowDefRecord.id,
      tenantId,
      triggerId: orderId,
      status: "RUNNING",
      contextJson: { orderId },
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { workflowRunId: workflowRun.id },
  });

  const result = await executeWorkflow(dag, {
    tenantId,
    orderId,
    workflowRunId: workflowRun.id,
    triggerId: orderId,
    data: {},
  });

  if (!result.success) {
    log.error({ failedStep: result.failedStep, error: result.error }, "Order workflow failed");
    throw new Error(`Workflow failed at step ${result.failedStep}: ${result.error}`);
  }

  log.info("Order workflow completed");
}

export function startOrderWorker() {
  const worker = createWorker<OrderJobPayload>(
    QUEUE_NAMES.ORDER,
    processOrderJob,
    { concurrency: 5 },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Order job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error: error.message }, "Order job failed");
  });

  logger.info("Order worker started");
  return worker;
}
