import type { NextRequest } from "next/server";
import { prisma } from "@dropflow/db";
import type { SupplierRankingItem } from "@dropflow/types";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

function currentPeriodUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function previousPeriod(period: string): string {
  const [ys, ms] = period.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = new Date(Date.UTC(y, m - 2, 1));
  const py = d.getUTCFullYear();
  const pm = d.getUTCMonth() + 1;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const periodParam = req.nextUrl.searchParams.get("period")?.trim();
    const period = periodParam && /^\d{4}-\d{2}$/.test(periodParam) ? periodParam : currentPeriodUtc();
    const prev = previousPeriod(period);

    const currentRows = await prisma.supplierScorecard.findMany({
      where: { tenantId, period },
      include: { supplier: true },
      orderBy: { overallScore: "desc" },
    });

    const prevRows = await prisma.supplierScorecard.findMany({
      where: { tenantId, period: prev },
      select: { supplierId: true, overallScore: true },
    });
    const prevBySupplier = new Map(prevRows.map((r) => [r.supplierId, r.overallScore]));

    const rankings: SupplierRankingItem[] = currentRows.map((row) => {
      const prevScore = prevBySupplier.get(row.supplierId);
      let trend: SupplierRankingItem["trend"] = "stable";
      if (prevScore !== undefined) {
        const delta = row.overallScore - prevScore;
        if (delta > 0.5) trend = "up";
        else if (delta < -0.5) trend = "down";
      }
      return {
        supplierId: row.supplierId,
        supplierName: row.supplier.name,
        overallScore: row.overallScore,
        fulfillmentRate: row.fulfillmentRate,
        defectRate: row.defectRate,
        returnRate: row.returnRate,
        trend,
      };
    });

    return ok(rankings);
  } catch (e) {
    return err(
      "RANKINGS_FETCH_FAILED",
      e instanceof Error ? e.message : "Failed to fetch rankings",
      400,
    );
  }
}
