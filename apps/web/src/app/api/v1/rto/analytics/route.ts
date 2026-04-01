import type { NextRequest } from "next/server";
import { prisma, type Prisma } from "@dropflow/db";
import { RTO } from "@dropflow/config";
import { RtoAnalyticsFilters, type RtoDashboardKPIs } from "@dropflow/types";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

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

    const orderCreatedAt: Prisma.DateTimeFilter | undefined =
      filters.dateFrom || filters.dateTo
        ? {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
          }
        : undefined;

    const orderWhere: Prisma.OrderWhereInput = {
      tenantId,
      ...(orderCreatedAt ? { createdAt: orderCreatedAt } : {}),
    };

    const logWhere: Prisma.RtoScoreLogWhereInput = {
      tenantId,
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [
      totalOrders,
      codOrders,
      prepaidOrders,
      rtoCount,
      nudgesSent,
      nudgesConvertedRows,
      riskGroups,
      revenueSample,
    ] = await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.order.count({
        where: { ...orderWhere, paymentMethod: "COD" },
      }),
      prisma.order.count({
        where: { ...orderWhere, paymentMethod: "PREPAID" },
      }),
      prisma.order.count({
        where: { ...orderWhere, status: "RETURNED" },
      }),
      prisma.rtoScoreLog.count({
        where: {
          ...logWhere,
          nudgeSentAt: { not: null },
        },
      }),
      prisma.rtoScoreLog.findMany({
        where: {
          ...logWhere,
          nudgeSentAt: { not: null },
          order: { paymentMethod: "PREPAID" },
        },
        select: { id: true },
      }),
      prisma.rtoScoreLog.groupBy({
        by: ["riskLevel"],
        where: logWhere,
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where: orderWhere,
        select: { totalPaise: true },
        take: 5000,
      }),
    ]);

    const codReturned = await prisma.order.count({
      where: {
        ...orderWhere,
        paymentMethod: "COD",
        status: "RETURNED",
      },
    });

    const codToRtoRate =
      codOrders > 0 ? (codReturned / codOrders) * 100 : 0;

    const rtoRate = totalOrders > 0 ? (rtoCount / totalOrders) * 100 : 0;

    const nudgesConverted = nudgesConvertedRows.length;
    const nudgeConversionRate =
      nudgesSent > 0 ? (nudgesConverted / nudgesSent) * 100 : 0;

    const revenueSum = revenueSample.reduce((s, o) => s + o.totalPaise, 0);
    const avgOrderValuePaise =
      revenueSample.length > 0
        ? Math.round(revenueSum / revenueSample.length)
        : 0;

    const estimatedSavingsPaise = Math.round(
      nudgesConverted *
        avgOrderValuePaise *
        (RTO.DEFAULT_RETURN_RESERVE_PERCENT / 100),
    );

    const riskDistribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    for (const g of riskGroups) {
      const c = g._count._all;
      if (g.riskLevel === "LOW") riskDistribution.low = c;
      else if (g.riskLevel === "MEDIUM") riskDistribution.medium = c;
      else if (g.riskLevel === "HIGH") riskDistribution.high = c;
      else if (g.riskLevel === "CRITICAL") riskDistribution.critical = c;
    }

    const data: RtoDashboardKPIs = {
      totalOrders,
      codOrders,
      prepaidOrders,
      rtoCount,
      rtoRate,
      codToRtoRate,
      nudgesSent,
      nudgesConverted,
      nudgeConversionRate,
      estimatedSavingsPaise,
      riskDistribution,
    };

    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (
      msg === "Unauthorized" ||
      msg === "No organization selected" ||
      msg === "Tenant not found"
    ) {
      return err("UNAUTHORIZED", msg, 401);
    }
    return err("RTO_ANALYTICS_FAILED", msg, 500);
  }
}
