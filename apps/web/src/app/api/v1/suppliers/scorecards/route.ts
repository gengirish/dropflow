import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, type Prisma } from "@dropflow/db";
import { QUEUE_NAMES } from "@dropflow/config";
import { SupplierScorecardFilters, type SupplierScorecardResponse } from "@dropflow/types";
import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

function toScorecardResponse(
  row: Prisma.SupplierScorecardGetPayload<{ include: { supplier: true } }>,
): SupplierScorecardResponse {
  return {
    supplierId: row.supplierId,
    supplierName: row.supplier.name,
    period: row.period,
    totalPOs: row.totalPOs,
    onTimePOs: row.onTimePOs,
    latePOs: row.latePOs,
    totalUnits: row.totalUnits,
    defectiveUnits: row.defectiveUnits,
    returnedUnits: row.returnedUnits,
    avgLeadTimeDays: row.avgLeadTimeDays,
    promisedLeadTimeDays: row.promisedLeadTimeDays,
    fulfillmentRate: row.fulfillmentRate,
    defectRate: row.defectRate,
    returnRate: row.returnRate,
    overallScore: row.overallScore,
  };
}

async function enqueueScorecardJob(jobName: string, payload: Record<string, unknown>) {
  const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
  const workerSecret = process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

  const res = await fetch(`${workerUrl}/internal/enqueue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": workerSecret,
    },
    body: JSON.stringify({
      queue: QUEUE_NAMES.SUPPLIER_SCORECARD,
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

const TriggerScorecardsBody = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  supplierId: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const sp = req.nextUrl.searchParams;
    const filters = SupplierScorecardFilters.parse({
      supplierId: sp.get("supplierId") ?? undefined,
      period: sp.get("period") ?? undefined,
      minScore: sp.get("minScore") ?? undefined,
      maxScore: sp.get("maxScore") ?? undefined,
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
    });

    const where: Prisma.SupplierScorecardWhereInput = { tenantId };
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.period) where.period = filters.period;
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      where.overallScore = {};
      if (filters.minScore !== undefined) where.overallScore.gte = filters.minScore;
      if (filters.maxScore !== undefined) where.overallScore.lte = filters.maxScore;
    }

    const [total, rows] = await Promise.all([
      prisma.supplierScorecard.count({ where }),
      prisma.supplierScorecard.findMany({
        where,
        include: { supplier: true },
        orderBy: [{ period: "desc" }, { overallScore: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ]);

    const items = rows.map(toScorecardResponse);
    return paginated(items, total, filters.page, filters.pageSize);
  } catch (e) {
    return err(
      "SCORECARDS_FETCH_FAILED",
      e instanceof Error ? e.message : "Failed to fetch scorecards",
      400,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const body = await req.json();
    const input = TriggerScorecardsBody.parse(body);

    if (input.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: input.supplierId, tenantId },
      });
      if (!supplier) {
        return err("SUPPLIER_NOT_FOUND", "Supplier not found", 404);
      }
      const { jobId } = await enqueueScorecardJob("compute-scorecard", {
        tenantId,
        supplierId: input.supplierId,
        period: input.period,
      });
      return ok({ jobId, jobName: "compute-scorecard" as const }, 202);
    }

    const { jobId } = await enqueueScorecardJob("compute-all-scorecards", {
      tenantId,
      period: input.period,
    });
    return ok({ jobId, jobName: "compute-all-scorecards" as const }, 202);
  } catch (e) {
    return err(
      "SCORECARDS_TRIGGER_FAILED",
      e instanceof Error ? e.message : "Failed to trigger scorecard job",
      400,
    );
  }
}
