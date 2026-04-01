import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, type Prisma } from "@dropflow/db";
import { RtoAnalyticsFilters } from "@dropflow/types";
import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

const ScoreOrderBody = z.object({
  orderId: z.string().min(1),
});

async function enqueueRtoJob(jobName: string, payload: Record<string, unknown>) {
  const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
  const workerSecret = process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

  const res = await fetch(`${workerUrl}/internal/enqueue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": workerSecret,
    },
    body: JSON.stringify({
      queue: "rto-queue",
      jobName,
      payload,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Enqueue failed: ${res.status}`);
  }

  return res.json() as Promise<{ jobId?: string }>;
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const sp = req.nextUrl.searchParams;

    const filters = RtoAnalyticsFilters.parse({
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      riskLevel: sp.get("riskLevel") ?? undefined,
      paymentMethod: sp.get("paymentMethod") ?? undefined,
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
    });

    const where: Prisma.RtoScoreLogWhereInput = { tenantId };

    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) createdAt.lte = new Date(filters.dateTo);
      where.createdAt = createdAt;
    }
    if (filters.riskLevel) {
      where.riskLevel = filters.riskLevel;
    }
    if (filters.paymentMethod) {
      where.order = { paymentMethod: filters.paymentMethod };
    }

    const [items, total] = await Promise.all([
      prisma.rtoScoreLog.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              buyerName: true,
              buyerPhone: true,
              totalPaise: true,
              paymentMethod: true,
              status: true,
              isRtoNudgeSent: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.rtoScoreLog.count({ where }),
    ]);

    return paginated(items, total, filters.page, filters.pageSize);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (
      msg === "Unauthorized" ||
      msg === "No organization selected" ||
      msg === "Tenant not found"
    ) {
      return err("UNAUTHORIZED", msg, 401);
    }
    return err("RTO_SCORE_LIST_FAILED", msg, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const body = await req.json();
    const { orderId } = ScoreOrderBody.parse(body);

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true },
    });
    if (!order) {
      return err("ORDER_NOT_FOUND", "Order not found", 404);
    }

    const { jobId } = await enqueueRtoJob("score-order", { tenantId, orderId });
    return ok({ jobId, orderId }, 202);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (
      msg === "Unauthorized" ||
      msg === "No organization selected" ||
      msg === "Tenant not found"
    ) {
      return err("UNAUTHORIZED", msg, 401);
    }
    if (e instanceof z.ZodError) {
      return err("VALIDATION_ERROR", e.message, 400);
    }
    return err("RTO_SCORE_ENQUEUE_FAILED", msg, 400);
  }
}
