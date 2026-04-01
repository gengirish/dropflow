import type { Job } from "bullmq";
import { prisma } from "@dropflow/db";
import { QUEUE_NAMES, RECONCILIATION } from "@dropflow/config";
import { createWorker } from "../lib/redis";
import { logger } from "../lib/logger";
import { broadcast } from "../sse/broadcaster";

const PAYMENT_GATEWAY_TYPE = "PAYMENT_GATEWAY";
const COD_CARRIER_TYPE = "COD_CARRIER";

type MatchSettlementPayload = { tenantId: string; settlementId: string };
type MatchCodRemittancePayload = { tenantId: string; remittanceId: string };
type AutoReconcilePayload = { tenantId: string };

type ReconciliationJobPayload =
  | MatchSettlementPayload
  | MatchCodRemittancePayload
  | AutoReconcilePayload;

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

async function refreshSettlementHeaderStatus(
  tenantId: string,
  settlementId: string,
  itemIds: string[],
): Promise<void> {
  if (itemIds.length === 0) return;

  const records = await prisma.reconciliationRecord.findMany({
    where: {
      tenantId,
      type: PAYMENT_GATEWAY_TYPE,
      referenceId: { in: itemIds },
    },
    select: { status: true },
  });

  let status = "PENDING";
  if (records.length === itemIds.length) {
    const allClear = records.every(
      (r) => r.status === "MATCHED" || r.status === "MANUAL_OVERRIDE",
    );
    const anyDisc = records.some((r) => r.status === "DISCREPANCY");
    const anyUnmatched = records.some((r) => r.status === "UNMATCHED");
    if (allClear && !anyDisc && !anyUnmatched) {
      status = "SETTLED";
    } else if (anyDisc) {
      status = "DISCREPANCY";
    }
  }

  await prisma.settlement.update({
    where: { id: settlementId },
    data: { status },
  });
}

async function refreshCodRemittanceHeaderStatus(
  tenantId: string,
  remittanceId: string,
  itemIds: string[],
): Promise<void> {
  if (itemIds.length === 0) return;

  const records = await prisma.reconciliationRecord.findMany({
    where: {
      tenantId,
      type: COD_CARRIER_TYPE,
      referenceId: { in: itemIds },
    },
    select: { status: true },
  });

  let status = "PENDING";
  if (records.length === itemIds.length) {
    const allClear = records.every(
      (r) => r.status === "MATCHED" || r.status === "MANUAL_OVERRIDE",
    );
    const anyDisc = records.some((r) => r.status === "DISCREPANCY");
    const anyUnmatched = records.some((r) => r.status === "UNMATCHED");
    if (allClear && !anyDisc && !anyUnmatched) {
      status = "SETTLED";
    } else if (anyDisc) {
      status = "DISCREPANCY";
    }
  }

  await prisma.codRemittance.update({
    where: { id: remittanceId },
    data: { status },
  });
}

async function matchSettlement(job: Job<MatchSettlementPayload>) {
  const { tenantId, settlementId } = job.data;

  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, tenantId },
    include: { items: true },
  });

  if (!settlement) {
    throw new Error(`Settlement not found: ${settlementId}`);
  }

  const itemIds = settlement.items.map((i) => i.id);

  await prisma.$transaction([
    prisma.reconciliationRecord.deleteMany({
      where: {
        tenantId,
        type: PAYMENT_GATEWAY_TYPE,
        referenceId: { in: itemIds },
      },
    }),
    prisma.settlementItem.updateMany({
      where: { settlementId },
      data: { isMatched: false, matchedPaymentId: null },
    }),
  ]);

  for (const item of settlement.items) {
    const payment = await prisma.payment.findFirst({
      where: { tenantId, gatewayPaymentId: item.gatewayPaymentId },
    });

    if (payment) {
      const diffAbs = Math.abs(item.amountPaise - payment.amountPaise);
      const status =
        diffAbs <= RECONCILIATION.TOLERANCE_PAISE ? "MATCHED" : "DISCREPANCY";

      await prisma.settlementItem.update({
        where: { id: item.id },
        data: { isMatched: true, matchedPaymentId: payment.id },
      });

      await prisma.reconciliationRecord.create({
        data: {
          tenantId,
          type: PAYMENT_GATEWAY_TYPE,
          referenceId: item.id,
          matchedId: payment.id,
          expectedAmountPaise: item.amountPaise,
          actualAmountPaise: payment.amountPaise,
          differencePaise: item.amountPaise - payment.amountPaise,
          status,
        },
      });
    } else {
      await prisma.reconciliationRecord.create({
        data: {
          tenantId,
          type: PAYMENT_GATEWAY_TYPE,
          referenceId: item.id,
          matchedId: null,
          expectedAmountPaise: item.amountPaise,
          actualAmountPaise: 0,
          differencePaise: item.amountPaise,
          status: "UNMATCHED",
        },
      });
    }
  }

  await refreshSettlementHeaderStatus(tenantId, settlementId, itemIds);

  broadcast(tenantId, {
    type: "reconciliation.settlement",
    data: { settlementId, gateway: settlement.gateway },
  });
}

async function matchCodRemittance(job: Job<MatchCodRemittancePayload>) {
  const { tenantId, remittanceId } = job.data;

  const remittance = await prisma.codRemittance.findFirst({
    where: { id: remittanceId, tenantId },
    include: { items: true },
  });

  if (!remittance) {
    throw new Error(`COD remittance not found: ${remittanceId}`);
  }

  const itemIds = remittance.items.map((i) => i.id);

  await prisma.$transaction([
    prisma.reconciliationRecord.deleteMany({
      where: {
        tenantId,
        type: COD_CARRIER_TYPE,
        referenceId: { in: itemIds },
      },
    }),
    prisma.codRemittanceItem.updateMany({
      where: { remittanceId },
      data: { isMatched: false, matchedOrderId: null },
    }),
  ]);

  for (const item of remittance.items) {
    let order: { id: string; totalPaise: number; paymentMethod: string } | null = null;

    if (item.orderId) {
      const o = await prisma.order.findFirst({
        where: { id: item.orderId, tenantId },
        select: { id: true, totalPaise: true, paymentMethod: true },
      });
      order = o;
    }

    if (!order) {
      const shipment = await prisma.shipment.findFirst({
        where: { tenantId, awbNumber: item.awbNumber },
        include: {
          order: { select: { id: true, totalPaise: true, paymentMethod: true } },
        },
      });
      order = shipment?.order ?? null;
    }

    if (order) {
      const diffAbs = Math.abs(item.amountPaise - order.totalPaise);
      const status =
        diffAbs <= RECONCILIATION.TOLERANCE_PAISE ? "MATCHED" : "DISCREPANCY";

      await prisma.codRemittanceItem.update({
        where: { id: item.id },
        data: { isMatched: true, matchedOrderId: order.id },
      });

      await prisma.reconciliationRecord.create({
        data: {
          tenantId,
          type: COD_CARRIER_TYPE,
          referenceId: item.id,
          matchedId: order.id,
          expectedAmountPaise: order.totalPaise,
          actualAmountPaise: item.amountPaise,
          differencePaise: order.totalPaise - item.amountPaise,
          status,
        },
      });
    } else {
      await prisma.reconciliationRecord.create({
        data: {
          tenantId,
          type: COD_CARRIER_TYPE,
          referenceId: item.id,
          matchedId: null,
          expectedAmountPaise: item.amountPaise,
          actualAmountPaise: 0,
          differencePaise: item.amountPaise,
          status: "UNMATCHED",
        },
      });
    }
  }

  await refreshCodRemittanceHeaderStatus(tenantId, remittanceId, itemIds);

  broadcast(tenantId, {
    type: "reconciliation.cod_remittance",
    data: { remittanceId, carrier: remittance.carrier },
  });
}

async function autoReconcile(job: Job<AutoReconcilePayload>) {
  const { tenantId } = job.data;
  const windowStart = addDays(new Date(), -RECONCILIATION.AUTO_MATCH_WINDOW_DAYS);

  const unmatched = await prisma.reconciliationRecord.findMany({
    where: {
      tenantId,
      status: "UNMATCHED",
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "asc" },
  });

  const usedPaymentIds = new Set(
    (
      await prisma.settlementItem.findMany({
        where: { tenantId, matchedPaymentId: { not: null } },
        select: { matchedPaymentId: true },
      })
    )
      .map((r) => r.matchedPaymentId)
      .filter((id): id is string => Boolean(id)),
  );

  const usedOrderIds = new Set(
    (
      await prisma.codRemittanceItem.findMany({
        where: { tenantId, matchedOrderId: { not: null } },
        select: { matchedOrderId: true },
      })
    )
      .map((r) => r.matchedOrderId)
      .filter((id): id is string => Boolean(id)),
  );

  let matchedCount = 0;

  for (const rec of unmatched) {
    if (rec.type === PAYMENT_GATEWAY_TYPE) {
      const settlementItem = await prisma.settlementItem.findFirst({
        where: { id: rec.referenceId, tenantId },
        include: { settlement: true },
      });
      if (!settlementItem) continue;

      const expected = rec.expectedAmountPaise;
      const d0 = settlementItem.settlement.settlementDate;
      const from = addDays(d0, -RECONCILIATION.AUTO_MATCH_WINDOW_DAYS);
      const to = addDays(d0, RECONCILIATION.AUTO_MATCH_WINDOW_DAYS);

      const paymentWhereBase: {
        tenantId: string;
        amountPaise: { gte: number; lte: number };
        createdAt: { gte: Date; lte: Date };
        id?: { notIn: string[] };
      } = {
        tenantId,
        amountPaise: {
          gte: expected - RECONCILIATION.TOLERANCE_PAISE,
          lte: expected + RECONCILIATION.TOLERANCE_PAISE,
        },
        createdAt: { gte: from, lte: to },
      };
      if (usedPaymentIds.size > 0) {
        paymentWhereBase.id = { notIn: [...usedPaymentIds] };
      }

      let payments = await prisma.payment.findMany({
        where: { ...paymentWhereBase, gateway: settlementItem.settlement.gateway },
        orderBy: { createdAt: "asc" },
        take: 3,
      });
      if (payments.length === 0) {
        payments = await prisma.payment.findMany({
          where: paymentWhereBase,
          orderBy: { createdAt: "asc" },
          take: 3,
        });
      }

      const payment = payments[0];
      if (!payment) continue;

      usedPaymentIds.add(payment.id);

      await prisma.$transaction([
        prisma.settlementItem.update({
          where: { id: settlementItem.id },
          data: { isMatched: true, matchedPaymentId: payment.id },
        }),
        prisma.reconciliationRecord.update({
          where: { id: rec.id },
          data: {
            status: "MATCHED",
            matchedId: payment.id,
            actualAmountPaise: payment.amountPaise,
            differencePaise: settlementItem.amountPaise - payment.amountPaise,
            notes: rec.notes
              ? `${rec.notes}\n[auto-reconcile]`
              : "[auto-reconcile]",
          },
        }),
      ]);

      await refreshSettlementHeaderStatus(
        tenantId,
        settlementItem.settlementId,
        (
          await prisma.settlementItem.findMany({
            where: { settlementId: settlementItem.settlementId },
            select: { id: true },
          })
        ).map((x) => x.id),
      );

      matchedCount += 1;
    } else if (rec.type === COD_CARRIER_TYPE) {
      const codItem = await prisma.codRemittanceItem.findFirst({
        where: { id: rec.referenceId, tenantId },
        include: { remittance: true },
      });
      if (!codItem) continue;

      const expected = rec.expectedAmountPaise;
      const d0 = codItem.remittance.remittanceDate;
      const from = addDays(d0, -RECONCILIATION.AUTO_MATCH_WINDOW_DAYS);
      const to = addDays(d0, RECONCILIATION.AUTO_MATCH_WINDOW_DAYS);

      const orderWhere: {
        tenantId: string;
        paymentMethod: "COD";
        totalPaise: { gte: number; lte: number };
        createdAt: { gte: Date; lte: Date };
        id?: { notIn: string[] };
      } = {
        tenantId,
        paymentMethod: "COD",
        totalPaise: {
          gte: expected - RECONCILIATION.TOLERANCE_PAISE,
          lte: expected + RECONCILIATION.TOLERANCE_PAISE,
        },
        createdAt: { gte: from, lte: to },
      };
      if (usedOrderIds.size > 0) {
        orderWhere.id = { notIn: [...usedOrderIds] };
      }

      const orders = await prisma.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: "asc" },
        take: 3,
      });

      const order = orders[0];
      if (!order) continue;

      usedOrderIds.add(order.id);

      await prisma.$transaction([
        prisma.codRemittanceItem.update({
          where: { id: codItem.id },
          data: { isMatched: true, matchedOrderId: order.id },
        }),
        prisma.reconciliationRecord.update({
          where: { id: rec.id },
          data: {
            status: "MATCHED",
            matchedId: order.id,
            expectedAmountPaise: order.totalPaise,
            actualAmountPaise: codItem.amountPaise,
            differencePaise: order.totalPaise - codItem.amountPaise,
            notes: rec.notes
              ? `${rec.notes}\n[auto-reconcile]`
              : "[auto-reconcile]",
          },
        }),
      ]);

      await refreshCodRemittanceHeaderStatus(
        tenantId,
        codItem.remittanceId,
        (
          await prisma.codRemittanceItem.findMany({
            where: { remittanceId: codItem.remittanceId },
            select: { id: true },
          })
        ).map((x) => x.id),
      );

      matchedCount += 1;
    }
  }

  logger.info({ tenantId, matchedCount }, "auto-reconcile completed");

  broadcast(tenantId, {
    type: "reconciliation.auto",
    data: { matchedCount },
  });
}

async function processReconciliationJob(job: Job<ReconciliationJobPayload>) {
  switch (job.name) {
    case "match-settlement":
      await matchSettlement(job as Job<MatchSettlementPayload>);
      break;
    case "match-cod-remittance":
      await matchCodRemittance(job as Job<MatchCodRemittancePayload>);
      break;
    case "auto-reconcile":
      await autoReconcile(job as Job<AutoReconcilePayload>);
      break;
    default:
      throw new Error(`Unknown reconciliation job name: ${job.name}`);
  }
}

export function startReconciliationWorker() {
  const worker = createWorker<ReconciliationJobPayload>(QUEUE_NAMES.RECONCILIATION, processReconciliationJob, {
    concurrency: 3,
  });

  worker.on("completed", (j) => {
    logger.info({ jobId: j.id, name: j.name }, "Reconciliation job completed");
  });

  worker.on("failed", (j, error) => {
    logger.error(
      { jobId: j?.id, name: j?.name, error: error.message },
      "Reconciliation job failed",
    );
  });

  logger.info("Reconciliation worker started");
  return worker;
}
