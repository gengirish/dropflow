import type { Job } from "bullmq";
import { prisma } from "@dropflow/db";
import { QUEUE_NAMES, SUPPLIER_SCORECARD } from "@dropflow/config";
import { createWorker } from "../lib/redis";
import { logger } from "../lib/logger";
import { broadcast } from "../sse/broadcaster";

type ComputeScorecardPayload = {
  tenantId: string;
  supplierId: string;
  period: string;
};

type ComputeAllScorecardsPayload = {
  tenantId: string;
  period: string;
};

type SupplierScorecardJobPayload = ComputeScorecardPayload | ComputeAllScorecardsPayload;

const DEFECT_INCIDENT_TYPES = ["DEFECT", "WRONG_ITEM", "QUALITY_ISSUE"] as const;

function parseYearMonth(period: string): { start: Date; endExclusive: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) {
    throw new Error(`Invalid period "${period}": expected YYYY-MM`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid period "${period}": month must be 01-12`);
  }
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, endExclusive };
}

function msToDays(ms: number): number {
  return ms / (24 * 60 * 60 * 1000);
}

function unitsFromSupplierOnOrder(
  order: {
    items: { quantity: number; product: { supplierId: string } }[];
  },
  supplierId: string,
): number {
  return order.items
    .filter((i) => i.product.supplierId === supplierId)
    .reduce((sum, i) => sum + i.quantity, 0);
}

export async function computeScorecardForSupplier(
  tenantId: string,
  supplierId: string,
  period: string,
): Promise<void> {
  const { start, endExclusive } = parseYearMonth(period);

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
  });
  if (!supplier) {
    throw new Error(`Supplier not found: ${supplierId}`);
  }

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      tenantId,
      supplierId,
      OR: [
        { sentAt: { gte: start, lt: endExclusive } },
        { AND: [{ sentAt: null }, { createdAt: { gte: start, lt: endExclusive } }] },
      ],
    },
    include: {
      order: {
        include: {
          items: { include: { product: true } },
        },
      },
    },
  });

  const leadTimeDays = supplier.leadTimeDays;
  const leadMs = leadTimeDays * 24 * 60 * 60 * 1000;

  let totalPOs = purchaseOrders.length;
  let onTimePOs = 0;
  const leadTimeSamples: number[] = [];
  let totalUnits = 0;

  for (const po of purchaseOrders) {
    const anchor = po.sentAt ?? po.createdAt;
    const ack = po.acknowledgedAt;

    totalUnits += unitsFromSupplierOnOrder(po.order, supplierId);

    if (ack && anchor) {
      const diffMs = ack.getTime() - anchor.getTime();
      leadTimeSamples.push(msToDays(diffMs));
      if (diffMs <= leadMs) {
        onTimePOs += 1;
      }
    }
  }

  const latePOs = totalPOs - onTimePOs;

  const defectiveIncidents = await prisma.supplierIncident.count({
    where: {
      tenantId,
      supplierId,
      createdAt: { gte: start, lt: endExclusive },
      type: { in: [...DEFECT_INCIDENT_TYPES] },
    },
  });
  const defectiveUnits = defectiveIncidents;

  const returnedOrders = await prisma.order.findMany({
    where: {
      tenantId,
      status: "RETURNED",
      updatedAt: { gte: start, lt: endExclusive },
      items: { some: { product: { supplierId } } },
    },
    include: {
      items: { include: { product: true } },
    },
  });

  let returnedUnits = 0;
  for (const ord of returnedOrders) {
    returnedUnits += unitsFromSupplierOnOrder(ord, supplierId);
  }

  const fulfillmentRate = totalPOs > 0 ? onTimePOs / totalPOs : 0;
  const defectRate = totalUnits > 0 ? defectiveUnits / totalUnits : 0;
  const returnRate = totalUnits > 0 ? returnedUnits / totalUnits : 0;

  let avgLeadTimeDays = 0;
  if (leadTimeSamples.length > 0) {
    avgLeadTimeDays =
      leadTimeSamples.reduce((a, b) => a + b, 0) / leadTimeSamples.length;
  }

  let leadTimeScore = 1;
  if (leadTimeSamples.length > 0 && avgLeadTimeDays > 0) {
    if (avgLeadTimeDays <= leadTimeDays) {
      leadTimeScore = 1;
    } else {
      leadTimeScore = Math.max(0, Math.min(1, leadTimeDays / avgLeadTimeDays));
    }
  }

  const {
    ON_TIME_WEIGHT,
    DEFECT_WEIGHT,
    RETURN_WEIGHT,
    LEAD_TIME_WEIGHT,
    ALERT_THRESHOLD,
  } = SUPPLIER_SCORECARD;

  const overallScore =
    (fulfillmentRate * ON_TIME_WEIGHT +
      (1 - defectRate) * DEFECT_WEIGHT +
      (1 - returnRate) * RETURN_WEIGHT +
      leadTimeScore * LEAD_TIME_WEIGHT) *
    100;

  await prisma.supplierScorecard.upsert({
    where: {
      tenantId_supplierId_period: { tenantId, supplierId, period },
    },
    create: {
      tenantId,
      supplierId,
      period,
      totalPOs,
      onTimePOs,
      latePOs,
      totalUnits,
      defectiveUnits,
      returnedUnits,
      avgLeadTimeDays,
      promisedLeadTimeDays: leadTimeDays,
      fulfillmentRate,
      defectRate,
      returnRate,
      overallScore,
    },
    update: {
      totalPOs,
      onTimePOs,
      latePOs,
      totalUnits,
      defectiveUnits,
      returnedUnits,
      avgLeadTimeDays,
      promisedLeadTimeDays: leadTimeDays,
      fulfillmentRate,
      defectRate,
      returnRate,
      overallScore,
      computedAt: new Date(),
    },
  });

  if (overallScore < ALERT_THRESHOLD) {
    broadcast(tenantId, {
      type: "SUPPLIER_SCORECARD_ALERT",
      data: {
        supplierId,
        supplierName: supplier.name,
        period,
        overallScore,
        fulfillmentRate,
        defectRate,
        returnRate,
      },
    });
  }
}

async function computeScorecard(job: Job<ComputeScorecardPayload>) {
  const { tenantId, supplierId, period } = job.data;
  await computeScorecardForSupplier(tenantId, supplierId, period);
}

async function computeAllScorecards(job: Job<ComputeAllScorecardsPayload>) {
  const { tenantId, period } = job.data;
  const suppliers = await prisma.supplier.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: { id: true },
  });
  for (const s of suppliers) {
    await computeScorecardForSupplier(tenantId, s.id, period);
  }
}

async function processSupplierScorecardJob(job: Job<SupplierScorecardJobPayload>) {
  switch (job.name) {
    case "compute-scorecard":
      await computeScorecard(job as Job<ComputeScorecardPayload>);
      break;
    case "compute-all-scorecards":
      await computeAllScorecards(job as Job<ComputeAllScorecardsPayload>);
      break;
    default:
      throw new Error(`Unknown supplier scorecard job name: ${job.name}`);
  }
}

export function startSupplierScorecardWorker() {
  const worker = createWorker<SupplierScorecardJobPayload>(
    QUEUE_NAMES.SUPPLIER_SCORECARD,
    processSupplierScorecardJob,
    { concurrency: 3 },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error: error.message }, "Job failed");
  });

  logger.info("Supplier scorecard worker started");
  return worker;
}
