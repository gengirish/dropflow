import { NOTIFICATION_TRIGGERS, QUEUE_NAMES, REORDER } from "@dropflow/config";
import { prisma } from "@dropflow/db";
import type { Job } from "bullmq";
import { logger } from "../lib/logger";
import { createWorker } from "../lib/redis";
import { broadcast } from "../sse/broadcaster";

type TenantPayload = { tenantId: string };

type ReorderJobPayload = TenantPayload;

function generatePONumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO/${yy}${mm}/${rand}`;
}

function generateReorderOrderNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-RS-${yy}${mm}-${rand}`;
}

const INTERNAL_ADDRESS = {
  line1: "Internal reorder",
  line2: "",
  city: "Mumbai",
  state: "MH",
  pin: "400001",
  country: "IN",
} as const;

async function createAutoPurchaseOrder(params: {
  tenantId: string;
  product: {
    id: string;
    supplierId: string;
    costPricePaise: number;
    gstRatePercent: number;
    hsnCode: string;
  };
  reorderQty: number;
}): Promise<{ poId: string }> {
  const { tenantId, product, reorderQty } = params;
  const unitPricePaise = product.costPricePaise;
  const lineTotalPaise = unitPricePaise * reorderQty;
  const taxPaise = Math.round((lineTotalPaise * product.gstRatePercent) / 100);
  const subtotalPaise = lineTotalPaise;
  const totalPaise = subtotalPaise + taxPaise;

  const orderNumber = generateReorderOrderNumber();

  const { poId } = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        tenantId,
        orderNumber,
        buyerName: "Stock replenishment",
        buyerEmail: "reorder@internal.local",
        buyerPhone: "+919000000000",
        shippingAddress: INTERNAL_ADDRESS,
        billingAddress: INTERNAL_ADDRESS,
        status: "PENDING",
        paymentMethod: "PREPAID",
        currency: "INR",
        subtotalPaise,
        discountPaise: 0,
        shippingFeePaise: 0,
        totalPaise,
        taxPaise,
        notes: "Auto-generated supplier reorder",
        items: {
          create: {
            tenantId,
            productId: product.id,
            quantity: reorderQty,
            unitPricePaise,
            totalPaise: lineTotalPaise,
            hsnCode: product.hsnCode,
          },
        },
        statusHistory: {
          create: {
            tenantId,
            status: "PENDING",
            note: "Auto reorder draft order",
          },
        },
      },
    });

    const po = await tx.purchaseOrder.create({
      data: {
        orderId: order.id,
        tenantId,
        supplierId: product.supplierId,
        poNumber: generatePONumber(),
        totalPaise,
        status: "SENT",
        sentAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: "PO_CREATED" },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        tenantId,
        status: "PO_CREATED",
        note: `Auto reorder PO ${po.poNumber} sent to supplier`,
      },
    });

    return { poId: po.id };
  });

  return { poId };
}

async function computeVelocity(job: Job<ReorderJobPayload>) {
  const { tenantId } = job.data;
  const log = logger.child({ tenantId, jobId: job.id });

  const lookbackStart = new Date();
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - REORDER.VELOCITY_LOOKBACK_DAYS);

  const aggregates = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      tenantId,
      order: {
        status: "DELIVERED",
        createdAt: { gte: lookbackStart },
      },
    },
    _sum: { quantity: true },
  });

  const soldMap = new Map(aggregates.map((a) => [a.productId, a._sum.quantity ?? 0]));

  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
  });

  const divisor = REORDER.VELOCITY_LOOKBACK_DAYS;

  for (const p of products) {
    const unitsSold = soldMap.get(p.id) ?? 0;
    const salesVelocityDaily = unitsSold / divisor;
    await prisma.product.update({
      where: { id: p.id },
      data: { salesVelocityDaily },
    });
  }

  log.info({ productCount: products.length }, "compute-velocity completed");
}

async function checkReorder(job: Job<ReorderJobPayload>) {
  const { tenantId } = job.data;
  const log = logger.child({ tenantId, jobId: job.id });

  const rules = await prisma.reorderRule.findMany({
    where: { tenantId },
    include: {
      product: {
        include: { supplier: true },
      },
    },
  });

  for (const rule of rules) {
    const product = rule.product;
    const availableStock = product.stockQty - product.reservedQty;
    const velocity = product.salesVelocityDaily;
    const daysOfStockRemaining =
      velocity > 0 ? availableStock / velocity : availableStock <= 0 ? 0 : 999;

    if (availableStock > rule.reorderPoint) {
      continue;
    }

    const openAlert = await prisma.reorderAlert.findFirst({
      where: {
        tenantId,
        productId: product.id,
        acknowledgedAt: null,
      },
    });

    if (openAlert) {
      continue;
    }

    let purchaseOrderId: string | undefined;
    let autoPoCreated = false;

    if (rule.isAutoPoEnabled) {
      try {
        const { poId } = await createAutoPurchaseOrder({
          tenantId,
          product: {
            id: product.id,
            supplierId: product.supplierId,
            costPricePaise: product.costPricePaise,
            gstRatePercent: product.gstRatePercent,
            hsnCode: product.hsnCode,
          },
          reorderQty: rule.reorderQty,
        });
        purchaseOrderId = poId;
        autoPoCreated = true;
      } catch (e) {
        logger.error(
          { err: e instanceof Error ? e.message : e, productId: product.id },
          "auto PO creation failed",
        );
      }
    }

    const alert = await prisma.reorderAlert.create({
      data: {
        tenantId,
        productId: product.id,
        currentStock: availableStock,
        reorderPoint: rule.reorderPoint,
        daysOfStockRemaining,
        suggestedQty: rule.reorderQty,
        supplierId: product.supplierId,
        autoPoCreated,
        purchaseOrderId,
      },
    });

    broadcast(tenantId, {
      type: NOTIFICATION_TRIGGERS.REORDER_ALERT,
      data: {
        kind: "reorder-alert",
        alertId: alert.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        suggestedQty: rule.reorderQty,
        autoPoCreated,
        purchaseOrderId,
      },
    });
  }

  log.info({ ruleCount: rules.length }, "check-reorder completed");
}

async function processReorderJob(job: Job<ReorderJobPayload>) {
  switch (job.name) {
    case "compute-velocity":
      await computeVelocity(job);
      break;
    case "check-reorder":
      await checkReorder(job);
      break;
    case "compute-velocity-and-check":
      await computeVelocity(job);
      await checkReorder(job);
      break;
    default:
      throw new Error(`Unknown reorder job name: ${job.name}`);
  }
}

export function startReorderWorker() {
  const worker = createWorker<ReorderJobPayload>(QUEUE_NAMES.REORDER, processReorderJob, {
    concurrency: 2,
  });

  worker.on("completed", (j) => {
    logger.info({ jobId: j.id, name: j.name }, "Reorder job completed");
  });

  worker.on("failed", (j, error) => {
    logger.error(
      { jobId: j?.id, name: j?.name, error: error.message },
      "Reorder job failed",
    );
  });

  logger.info("Reorder worker started");
  return worker;
}
