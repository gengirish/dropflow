import type { Job } from "bullmq";
import { prisma } from "@dropflow/db";
import { RTO, QUEUE_NAMES } from "@dropflow/config";
import { AddressSchema, type RtoSignals } from "@dropflow/types";
import { createWorker } from "../lib/redis";
import { logger } from "../lib/logger";
import { broadcast } from "../sse/broadcaster";

type ScoreOrderPayload = {
  tenantId: string;
  orderId: string;
};

type UpdatePincodeStatsPayload = {
  tenantId: string;
  orderId: string;
  outcome: "DELIVERED" | "RTO";
};

type SendNudgePayload = {
  tenantId: string;
  orderId: string;
  channel: "WHATSAPP" | "SMS";
};

type RtoJobPayload = ScoreOrderPayload | UpdatePincodeStatsPayload | SendNudgePayload;

const LOW_PIN_PENALTY = 20;
const HIGH_ORDER_VALUE_BONUS = 10;

function parseShippingPin(shippingAddress: unknown): string | null {
  const parsed = AddressSchema.safeParse(shippingAddress);
  if (!parsed.success) return null;
  return parsed.data.pin;
}

function addressScoreFromShipping(shippingAddress: unknown): number {
  const parsed = AddressSchema.safeParse(shippingAddress);
  if (!parsed.success) return 30;
  const a = parsed.data;
  let s = 45;
  if (a.line1.length >= 8) s += 15;
  if (a.line2 && a.line2.trim().length > 0) s += 15;
  if (a.city.length >= 2) s += 15;
  if (a.state.length >= 2) s += 10;
  return Math.min(100, s);
}

function riskLevelFromScore(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= RTO.HIGH_RISK_THRESHOLD) return "CRITICAL";
  if (score >= RTO.MEDIUM_RISK_THRESHOLD) return "HIGH";
  if (score >= RTO.LOW_RISK_THRESHOLD) return "MEDIUM";
  return "LOW";
}

async function scoreOrder(job: Job<ScoreOrderPayload>) {
  const { tenantId, orderId } = job.data;

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
  });
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const pincode = parseShippingPin(order.shippingAddress) ?? "";
  const pinRow = pincode
    ? await prisma.pincodeDeliverability.findUnique({ where: { pincode } })
    : null;

  const pinDeliverability = Math.min(
    1,
    Math.max(0, pinRow?.deliveryRate ?? 1),
  );

  const [prevDelivered, prevRtos] = await Promise.all([
    prisma.order.count({
      where: {
        tenantId,
        buyerPhone: order.buyerPhone,
        status: "DELIVERED",
        id: { not: orderId },
        createdAt: { lt: order.createdAt },
      },
    }),
    prisma.order.count({
      where: {
        tenantId,
        buyerPhone: order.buyerPhone,
        status: "RETURNED",
        id: { not: orderId },
        createdAt: { lt: order.createdAt },
      },
    }),
  ]);

  const isRepeatBuyer = prevDelivered > 0;

  let score = 0;
  const isCod = order.paymentMethod === "COD";
  if (isCod) {
    score += RTO.COD_PENALTY_SCORE;
  }
  if (pinRow && pinDeliverability < RTO.LOW_PIN_DELIVERABILITY_THRESHOLD) {
    score += LOW_PIN_PENALTY;
  }
  if (isRepeatBuyer) {
    score -= RTO.REPEAT_BUYER_DISCOUNT;
  }
  if (order.totalPaise > RTO.HIGH_ORDER_VALUE_THRESHOLD_PAISE) {
    score += HIGH_ORDER_VALUE_BONUS;
  }

  score = Math.max(0, Math.min(100, score));

  const riskLevel = riskLevelFromScore(score);
  const recommendation =
    riskLevel === "HIGH" || riskLevel === "CRITICAL" ? "NUDGE_PREPAID" : "ALLOW";

  const signals: RtoSignals = {
    addressScore: addressScoreFromShipping(order.shippingAddress),
    phoneVerified: false,
    pinDeliverability,
    isRepeatBuyer,
    orderValuePaise: order.totalPaise,
    paymentMethod: isCod ? "COD" : "PREPAID",
    pincode: pincode || "",
    previousOrders: prevDelivered,
    previousRtos: prevRtos,
  };

  await prisma.$transaction([
    prisma.rtoScoreLog.upsert({
      where: { orderId },
      create: {
        orderId,
        tenantId,
        score,
        riskLevel,
        signals: signals as object,
      },
      update: {
        score,
        riskLevel,
        signals: signals as object,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: {
        rtoScore: score,
        rtoRiskLevel: riskLevel,
      },
    }),
  ]);

  broadcast(tenantId, {
    type: "RTO_SCORED",
    data: {
      orderId,
      score,
      riskLevel,
      recommendation,
    },
  });
}

async function updatePincodeStats(job: Job<UpdatePincodeStatsPayload>) {
  const { tenantId, orderId, outcome } = job.data;

  if (outcome !== "DELIVERED" && outcome !== "RTO") {
    throw new Error(`Invalid outcome: ${outcome}`);
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
  });
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const pincode = parseShippingPin(order.shippingAddress);
  if (!pincode) {
    logger.warn({ orderId }, "update-pincode-stats: missing PIN, skipping");
    return;
  }

  const existing = await prisma.pincodeDeliverability.findUnique({
    where: { pincode },
  });

  const totalShipments = (existing?.totalShipments ?? 0) + 1;
  const totalDelivered =
    (existing?.totalDelivered ?? 0) + (outcome === "DELIVERED" ? 1 : 0);
  const totalRto = (existing?.totalRto ?? 0) + (outcome === "RTO" ? 1 : 0);
  const deliveryRate = totalShipments > 0 ? totalDelivered / totalShipments : 0;

  await prisma.pincodeDeliverability.upsert({
    where: { pincode },
    create: {
      pincode,
      totalShipments: 1,
      totalDelivered: outcome === "DELIVERED" ? 1 : 0,
      totalRto: outcome === "RTO" ? 1 : 0,
      deliveryRate,
      lastUpdatedAt: new Date(),
    },
    update: {
      totalShipments,
      totalDelivered,
      totalRto,
      deliveryRate,
      lastUpdatedAt: new Date(),
    },
  });
}

async function sendNudge(job: Job<SendNudgePayload>) {
  const { tenantId, orderId, channel } = job.data;

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
  });
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  logger.info(
    { tenantId, orderId, channel },
    "RTO COD-to-prepaid nudge dispatched",
  );

  const now = new Date();
  await prisma.$transaction([
    prisma.rtoScoreLog.updateMany({
      where: { orderId, tenantId },
      data: {
        nudgeSentAt: now,
        nudgeChannel: channel,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { isRtoNudgeSent: true },
    }),
  ]);

  broadcast(tenantId, {
    type: "RTO_NUDGE_SENT",
    data: { orderId, channel },
  });
}

async function processRtoJob(job: Job<RtoJobPayload>) {
  const log = logger.child({ jobId: job.id, jobName: job.name });

  switch (job.name) {
    case "score-order": {
      const payload = job.data as ScoreOrderPayload;
      log.info(
        { tenantId: payload.tenantId, orderId: payload.orderId },
        "Scoring order for RTO risk",
      );
      await scoreOrder(job as Job<ScoreOrderPayload>);
      log.info("RTO score completed");
      break;
    }
    case "update-pincode-stats": {
      const payload = job.data as UpdatePincodeStatsPayload;
      log.info(
        {
          tenantId: payload.tenantId,
          orderId: payload.orderId,
          outcome: payload.outcome,
        },
        "Updating pincode deliverability",
      );
      await updatePincodeStats(job as Job<UpdatePincodeStatsPayload>);
      log.info("Pincode stats updated");
      break;
    }
    case "send-nudge": {
      const payload = job.data as SendNudgePayload;
      log.info(
        {
          tenantId: payload.tenantId,
          orderId: payload.orderId,
          channel: payload.channel,
        },
        "Sending RTO nudge",
      );
      await sendNudge(job as Job<SendNudgePayload>);
      log.info("RTO nudge recorded");
      break;
    }
    default:
      throw new Error(`Unknown RTO job name: ${job.name}`);
  }
}

export function startRtoWorker() {
  const worker = createWorker<RtoJobPayload>(QUEUE_NAMES.RTO, processRtoJob, {
    concurrency: 5,
  });

  worker.on("completed", (j) => {
    logger.info({ jobId: j.id }, "RTO job completed");
  });

  worker.on("failed", (j, error) => {
    logger.error({ jobId: j?.id, error: error.message }, "RTO job failed");
  });

  logger.info("RTO worker started");
  return worker;
}
