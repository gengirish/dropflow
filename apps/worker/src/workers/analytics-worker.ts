import type { Job } from "bullmq";
import { prisma } from "@dropflow/db";
import { ANALYTICS, MARGIN, QUEUE_NAMES } from "@dropflow/config";
import { createWorker } from "../lib/redis";
import { logger } from "../lib/logger";
import { broadcast } from "../sse/broadcaster";

type ComputeSkuEconomicsPayload = {
  tenantId: string;
  period: string;
};

type ComputeDailyRevenuePayload = {
  tenantId: string;
  date: string;
};

type ComputeOrderMarginsPayload = {
  tenantId: string;
  orderId: string;
};

type AnalyticsJobPayload =
  | ComputeSkuEconomicsPayload
  | ComputeDailyRevenuePayload
  | ComputeOrderMarginsPayload;

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

function parseDateOnly(dateStr: string): { dayStart: Date; dayEndExclusive: Date; dateOnly: Date } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    throw new Error(`Invalid date "${dateStr}": expected YYYY-MM-DD`);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const dayEndExclusive = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  if (Number.isNaN(dayStart.getTime())) {
    throw new Error(`Invalid date "${dateStr}"`);
  }
  return { dayStart, dayEndExclusive, dateOnly: dayStart };
}

async function computeSkuEconomics(job: Job<ComputeSkuEconomicsPayload>) {
  const { tenantId, period } = job.data;
  const { start, endExclusive } = parseYearMonth(period);
  const gatewayPct = ANALYTICS.GATEWAY_FEE_PERCENT;

  const deliveredOrders = await prisma.order.findMany({
    where: {
      tenantId,
      status: "DELIVERED",
      updatedAt: { gte: start, lt: endExclusive },
    },
    include: {
      items: { include: { product: true } },
    },
  });

  const returnedOrders = await prisma.order.findMany({
    where: {
      tenantId,
      status: "RETURNED",
      updatedAt: { gte: start, lt: endExclusive },
    },
    include: {
      items: { include: { product: true } },
    },
  });

  type Agg = {
    unitsSold: number;
    unitsReturned: number;
    revenuePaise: number;
    cogsPaise: number;
    gstPaise: number;
    shippingPaise: number;
    gatewayFeePaise: number;
    returnCostPaise: number;
  };

  const byProduct = new Map<string, Agg>();

  function ensureAgg(productId: string): Agg {
    let a = byProduct.get(productId);
    if (!a) {
      a = {
        unitsSold: 0,
        unitsReturned: 0,
        revenuePaise: 0,
        cogsPaise: 0,
        gstPaise: 0,
        shippingPaise: 0,
        gatewayFeePaise: 0,
        returnCostPaise: 0,
      };
      byProduct.set(productId, a);
    }
    return a;
  }

  for (const order of deliveredOrders) {
    const subtotal = order.subtotalPaise;
    const total = order.totalPaise;
    const orderGatewayFee =
      total > 0 ? Math.round((total * gatewayPct) / 100) : 0;

    for (const item of order.items) {
      const agg = ensureAgg(item.productId);
      const lineRev = item.totalPaise;
      const lineCogs = item.product.costPricePaise * item.quantity;
      agg.unitsSold += item.quantity;
      agg.revenuePaise += lineRev;
      agg.cogsPaise += lineCogs;

      if (subtotal > 0) {
        const share = lineRev / subtotal;
        agg.gstPaise += Math.round(share * order.taxPaise);
        agg.shippingPaise += Math.round(share * order.shippingFeePaise);
      }

      if (total > 0) {
        const shareTotal = lineRev / total;
        agg.gatewayFeePaise += Math.round(shareTotal * orderGatewayFee);
      }
    }
  }

  for (const order of returnedOrders) {
    for (const item of order.items) {
      const agg = ensureAgg(item.productId);
      agg.unitsReturned += item.quantity;
      agg.returnCostPaise += item.product.costPricePaise * item.quantity;
    }
  }

  for (const [productId, agg] of byProduct) {
    const netProfitPaise =
      agg.revenuePaise -
      agg.cogsPaise -
      agg.gstPaise -
      agg.shippingPaise -
      agg.gatewayFeePaise -
      agg.returnCostPaise;
    const marginPercent =
      agg.revenuePaise > 0 ? (netProfitPaise / agg.revenuePaise) * 100 : 0;

    await prisma.skuEconomics.upsert({
      where: {
        tenantId_productId_period: { tenantId, productId, period },
      },
      create: {
        tenantId,
        productId,
        period,
        unitsSold: agg.unitsSold,
        unitsReturned: agg.unitsReturned,
        revenuePaise: agg.revenuePaise,
        cogsPaise: agg.cogsPaise,
        gstPaise: agg.gstPaise,
        shippingPaise: agg.shippingPaise,
        gatewayFeePaise: agg.gatewayFeePaise,
        returnCostPaise: agg.returnCostPaise,
        netProfitPaise,
        marginPercent,
        computedAt: new Date(),
      },
      update: {
        unitsSold: agg.unitsSold,
        unitsReturned: agg.unitsReturned,
        revenuePaise: agg.revenuePaise,
        cogsPaise: agg.cogsPaise,
        gstPaise: agg.gstPaise,
        shippingPaise: agg.shippingPaise,
        gatewayFeePaise: agg.gatewayFeePaise,
        returnCostPaise: agg.returnCostPaise,
        netProfitPaise,
        marginPercent,
        computedAt: new Date(),
      },
    });
  }

  broadcast(tenantId, {
    type: "ANALYTICS_COMPUTED",
    data: {
      kind: "compute-sku-economics",
      period,
      productCount: byProduct.size,
    },
  });
}

async function computeDailyRevenue(job: Job<ComputeDailyRevenuePayload>) {
  const { tenantId, date } = job.data;
  const { dayStart, dayEndExclusive, dateOnly } = parseDateOnly(date);

  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      createdAt: { gte: dayStart, lt: dayEndExclusive },
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
    include: {
      items: { include: { product: true } },
    },
  });

  let revenuePaise = 0;
  let cogsPaise = 0;
  const skuRevenue = new Map<string, number>();

  for (const order of orders) {
    revenuePaise += order.totalPaise;
    for (const item of order.items) {
      const lineCogs = item.product.costPricePaise * item.quantity;
      cogsPaise += lineCogs;
      skuRevenue.set(
        item.productId,
        (skuRevenue.get(item.productId) ?? 0) + item.totalPaise,
      );
    }
  }

  const orderCount = orders.length;
  const profitPaise = revenuePaise - cogsPaise;
  const avgOrderValue =
    orderCount > 0 ? Math.round(revenuePaise / orderCount) : 0;

  let topSkuId: string | null = null;
  let topRev = 0;
  for (const [pid, rev] of skuRevenue) {
    if (rev > topRev) {
      topRev = rev;
      topSkuId = pid;
    }
  }

  await prisma.dailyRevenue.upsert({
    where: {
      tenantId_date: { tenantId, date: dateOnly },
    },
    create: {
      tenantId,
      date: dateOnly,
      orderCount,
      revenuePaise,
      cogsPaise,
      profitPaise,
      avgOrderValue,
      topSkuId,
      computedAt: new Date(),
    },
    update: {
      orderCount,
      revenuePaise,
      cogsPaise,
      profitPaise,
      avgOrderValue,
      topSkuId,
      computedAt: new Date(),
    },
  });

  broadcast(tenantId, {
    type: "ANALYTICS_COMPUTED",
    data: {
      kind: "compute-daily-revenue",
      date,
      orderCount,
    },
  });
}

async function computeOrderMargins(job: Job<ComputeOrderMarginsPayload>) {
  const { tenantId, orderId } = job.data;

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      items: { include: { product: true } },
    },
  });

  if (!order) {
    logger.warn({ tenantId, orderId }, "compute-order-margins: order not found");
    return;
  }

  const sellingPricePaise = order.subtotalPaise;
  let costPricePaise = 0;
  let packagingCostPaise = 0;

  for (const item of order.items) {
    const { product } = item;
    costPricePaise += product.costPricePaise * item.quantity;
    const packUnit =
      product.packagingCostPaise > 0
        ? product.packagingCostPaise
        : MARGIN.DEFAULT_PACKAGING_COST_PAISE;
    packagingCostPaise += packUnit * item.quantity;
  }

  const gstPaise = order.taxPaise;
  const shippingCostPaise = order.shippingFeePaise;
  const gatewayFeePaise = Math.round(
    (order.totalPaise * ANALYTICS.GATEWAY_FEE_PERCENT) / 100,
  );
  const returnReservePaise = Math.round(
    (order.subtotalPaise * MARGIN.DEFAULT_RETURN_RESERVE_PERCENT) / 100,
  );
  const discountPaise = order.discountPaise;
  const otherCostsPaise = 0;

  const netMarginPaise =
    sellingPricePaise -
    costPricePaise -
    gstPaise -
    shippingCostPaise -
    gatewayFeePaise -
    packagingCostPaise -
    returnReservePaise -
    discountPaise;

  const marginPercent =
    sellingPricePaise > 0 ? (netMarginPaise / sellingPricePaise) * 100 : 0;

  await prisma.orderMarginBreakdown.upsert({
    where: { orderId },
    create: {
      orderId,
      tenantId,
      sellingPricePaise,
      costPricePaise,
      gstPaise,
      shippingCostPaise,
      gatewayFeePaise,
      packagingCostPaise,
      returnReservePaise,
      discountPaise,
      otherCostsPaise,
      netMarginPaise,
      marginPercent,
      computedAt: new Date(),
    },
    update: {
      sellingPricePaise,
      costPricePaise,
      gstPaise,
      shippingCostPaise,
      gatewayFeePaise,
      packagingCostPaise,
      returnReservePaise,
      discountPaise,
      otherCostsPaise,
      netMarginPaise,
      marginPercent,
      computedAt: new Date(),
    },
  });

  broadcast(tenantId, {
    type: "ANALYTICS_COMPUTED",
    data: {
      kind: "compute-order-margins",
      orderId,
      netMarginPaise,
      marginPercent,
    },
  });
}

async function processAnalyticsJob(job: Job<AnalyticsJobPayload>) {
  const log = logger.child({ jobId: job.id, jobName: job.name });

  switch (job.name) {
    case "compute-sku-economics": {
      const payload = job.data as ComputeSkuEconomicsPayload;
      log.info(
        { tenantId: payload.tenantId, period: payload.period },
        "Computing SKU economics",
      );
      await computeSkuEconomics(job as Job<ComputeSkuEconomicsPayload>);
      log.info("SKU economics computation completed");
      break;
    }
    case "compute-daily-revenue": {
      const payload = job.data as ComputeDailyRevenuePayload;
      log.info(
        { tenantId: payload.tenantId, date: payload.date },
        "Computing daily revenue",
      );
      await computeDailyRevenue(job as Job<ComputeDailyRevenuePayload>);
      log.info("Daily revenue computation completed");
      break;
    }
    case "compute-order-margins": {
      const payload = job.data as ComputeOrderMarginsPayload;
      log.info(
        { tenantId: payload.tenantId, orderId: payload.orderId },
        "Computing order margins",
      );
      await computeOrderMargins(job as Job<ComputeOrderMarginsPayload>);
      log.info("Order margin computation completed");
      break;
    }
    default:
      throw new Error(`Unknown analytics job name: ${job.name}`);
  }
}

export function startAnalyticsWorker() {
  const worker = createWorker<AnalyticsJobPayload>(
    QUEUE_NAMES.ANALYTICS,
    processAnalyticsJob,
    { concurrency: 3 },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Analytics job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      "Analytics job failed",
    );
  });

  logger.info("Analytics worker started");
  return worker;
}
