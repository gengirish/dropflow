import type { Job } from "bullmq";
import { prisma, type RefundMethod, type ReturnStatus } from "@dropflow/db";
import { RETURNS, QUEUE_NAMES } from "@dropflow/config";
import { createWorker } from "../lib/redis";
import { logger } from "../lib/logger";
import { broadcast } from "../sse/broadcaster";

type ProcessReturnPayload = {
  tenantId: string;
  returnRequestId: string;
};

type ProcessQcPayload = {
  tenantId: string;
  returnRequestId: string;
  passed: boolean;
  notes?: string;
};

type ProcessRefundPayload = {
  tenantId: string;
  returnRequestId: string;
  method: RefundMethod;
  amountPaise: number;
};

type ReturnsJobPayload = ProcessReturnPayload | ProcessQcPayload | ProcessRefundPayload;

function returnWindowDeadlineMs(orderCreatedAt: Date): number {
  return orderCreatedAt.getTime() + RETURNS.DEFAULT_RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

async function processReturn(job: Job<ProcessReturnPayload>) {
  const { tenantId, returnRequestId } = job.data;
  const log = logger.child({ tenantId, returnRequestId, jobId: job.id });

  const ret = await prisma.returnRequest.findFirst({
    where: { id: returnRequestId, tenantId },
    include: { order: true, items: true },
  });

  if (!ret) {
    throw new Error(`Return request not found: ${returnRequestId}`);
  }

  if (ret.status !== "REQUESTED") {
    log.info({ status: ret.status }, "process-return skipped (not REQUESTED)");
    return;
  }

  const withinWindow = Date.now() <= returnWindowDeadlineMs(ret.order.createdAt);
  const nextStatus: ReturnStatus = withinWindow ? "APPROVED" : "REJECTED";

  await prisma.returnRequest.update({
    where: { id: returnRequestId },
    data: { status: nextStatus },
  });

  log.info({ nextStatus, withinWindow }, "process-return completed");
  broadcast(tenantId, {
    type: "RETURN",
    data: { kind: "process-return", returnRequestId, status: nextStatus },
  });
}

async function processQc(job: Job<ProcessQcPayload>) {
  const { tenantId, returnRequestId, passed, notes } = job.data;
  const log = logger.child({ tenantId, returnRequestId, jobId: job.id });

  const ret = await prisma.returnRequest.findFirst({
    where: { id: returnRequestId, tenantId },
    include: { items: true },
  });

  if (!ret) {
    throw new Error(`Return request not found: ${returnRequestId}`);
  }

  if (ret.status !== "RECEIVED") {
    throw new Error(`QC requires status RECEIVED, got ${ret.status}`);
  }

  const now = new Date();
  const nextStatus: ReturnStatus = passed ? "QC_PASSED" : "QC_FAILED";

  if (passed) {
    await prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: {
          status: nextStatus,
          qcNotes: notes ?? ret.qcNotes,
          qcPassedAt: now,
          qcFailedAt: null,
        },
      });

      for (const item of ret.items) {
        await tx.returnItem.update({
          where: { id: item.id },
          data: { restocked: true },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });

        await tx.inventoryTransaction.create({
          data: {
            tenantId,
            productId: item.productId,
            channelId: null,
            type: "RETURN",
            quantity: item.quantity,
            referenceType: "RETURN_REQUEST",
            referenceId: returnRequestId,
            note: `Return ${ret.returnNumber} QC passed`,
          },
        });
      }
    });
  } else {
    await prisma.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        status: nextStatus,
        qcNotes: notes ?? ret.qcNotes,
        qcFailedAt: now,
        qcPassedAt: null,
      },
    });
  }

  log.info({ nextStatus, passed }, "process-qc completed");
  broadcast(tenantId, {
    type: "RETURN",
    data: { kind: "process-qc", returnRequestId, status: nextStatus },
  });
}

async function processRefund(job: Job<ProcessRefundPayload>) {
  const { tenantId, returnRequestId, method, amountPaise } = job.data;
  const log = logger.child({ tenantId, returnRequestId, jobId: job.id });

  const ret = await prisma.returnRequest.findFirst({
    where: { id: returnRequestId, tenantId },
    include: { refund: true, order: true },
  });

  if (!ret) {
    throw new Error(`Return request not found: ${returnRequestId}`);
  }

  if (ret.status !== "QC_PASSED") {
    throw new Error(`Refund requires status QC_PASSED, got ${ret.status}`);
  }

  if (ret.refund?.status === "COMPLETED") {
    log.info("process-refund skipped (already completed)");
    return;
  }

  const processedAt = new Date();

  await prisma.$transaction(async (tx) => {
    if (ret.refund) {
      await tx.refund.update({
        where: { id: ret.refund.id },
        data: {
          method,
          amountPaise,
          status: "INITIATED",
          processedAt: null,
        },
      });
    } else {
      await tx.refund.create({
        data: {
          tenantId,
          returnRequestId,
          orderId: ret.orderId,
          method,
          amountPaise,
          status: "INITIATED",
        },
      });
    }

    await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: { status: "REFUND_INITIATED" },
    });
  });

  log.info(
    { method, amountPaise, orderId: ret.orderId },
    "mock refund gateway: processing refund (simulated success)",
  );

  await prisma.$transaction(async (tx) => {
    await tx.refund.update({
      where: { returnRequestId },
      data: { status: "COMPLETED", processedAt },
    });

    await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: { status: "REFUND_COMPLETED" },
    });

    await tx.order.update({
      where: { id: ret.orderId },
      data: { status: "REFUNDED" },
    });
  });

  log.info({ processedAt }, "process-refund completed");
  broadcast(tenantId, {
    type: "RETURN",
    data: { kind: "process-refund", returnRequestId, status: "REFUND_COMPLETED" },
  });
}

async function processReturnsJob(job: Job<ReturnsJobPayload>) {
  switch (job.name) {
    case "process-return":
      await processReturn(job as Job<ProcessReturnPayload>);
      break;
    case "process-qc":
      await processQc(job as Job<ProcessQcPayload>);
      break;
    case "process-refund":
      await processRefund(job as Job<ProcessRefundPayload>);
      break;
    default:
      throw new Error(`Unknown returns job name: ${job.name}`);
  }
}

export function startReturnsWorker() {
  const worker = createWorker<ReturnsJobPayload>(QUEUE_NAMES.RETURNS, processReturnsJob, {
    concurrency: 3,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, name: job.name }, "Returns job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, name: job?.name, error: error.message },
      "Returns job failed",
    );
  });

  logger.info("Returns worker started");
  return worker;
}
