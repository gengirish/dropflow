import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, type Prisma } from "@dropflow/db";
import { ReorderAlertFilters, type ReorderAlertResponse } from "@dropflow/types";
import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

const AcknowledgeInput = z.object({
  alertId: z.string().min(1),
});

function alertUrgency(
  days: number,
  supplierLeadTimeDays: number,
): "critical" | "warning" | "normal" {
  if (days <= 0) return "critical";
  if (days <= supplierLeadTimeDays) return "critical";
  if (days <= supplierLeadTimeDays * 2) return "warning";
  return "normal";
}

function toResponse(
  row: {
    id: string;
    productId: string;
    currentStock: number;
    reorderPoint: number;
    daysOfStockRemaining: number;
    suggestedQty: number;
    autoPoCreated: boolean;
    purchaseOrderId: string | null;
    acknowledgedAt: Date | null;
    createdAt: Date;
    product: { name: string; sku: string };
    supplierId: string | null;
  },
  supplierName?: string,
): ReorderAlertResponse {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    sku: row.product.sku,
    currentStock: row.currentStock,
    reorderPoint: row.reorderPoint,
    daysOfStockRemaining: row.daysOfStockRemaining,
    suggestedQty: row.suggestedQty,
    supplierName,
    autoPoCreated: row.autoPoCreated,
    purchaseOrderId: row.purchaseOrderId ?? undefined,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const sp = req.nextUrl.searchParams;

    const filters = ReorderAlertFilters.parse({
      acknowledged: sp.get("acknowledged") ?? undefined,
      autoPoCreated: sp.get("autoPoCreated") ?? undefined,
      urgency: sp.get("urgency") ?? undefined,
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
    });

    const where: Prisma.ReorderAlertWhereInput = {
      tenantId,
    };

    if (filters.acknowledged === true) {
      where.acknowledgedAt = { not: null };
    } else if (filters.acknowledged === false) {
      where.acknowledgedAt = null;
    }

    if (filters.autoPoCreated === true) {
      where.autoPoCreated = true;
    } else if (filters.autoPoCreated === false) {
      where.autoPoCreated = false;
    }

    const rows = await prisma.reorderAlert.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true, supplier: { select: { name: true, leadTimeDays: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = rows.map((r) => {
      const lead = r.product.supplier?.leadTimeDays ?? 7;
      return {
        row: r,
        urgency: alertUrgency(r.daysOfStockRemaining, lead),
        supplierName: r.product.supplier?.name,
      };
    });

    const filtered =
      filters.urgency === undefined
        ? mapped
        : mapped.filter((m) => m.urgency === filters.urgency);

    const total = filtered.length;
    const start = (filters.page - 1) * filters.pageSize;
    const pageRows = filtered.slice(start, start + filters.pageSize);

    const items = pageRows.map((m) => toResponse(m.row, m.supplierName));

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
    return err("REORDER_ALERTS_FETCH_FAILED", msg, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const body = await req.json();
    const { alertId } = AcknowledgeInput.parse(body);

    const updated = await prisma.reorderAlert.updateMany({
      where: { id: alertId, tenantId },
      data: { acknowledgedAt: new Date() },
    });

    if (updated.count === 0) {
      return err("REORDER_ALERT_NOT_FOUND", "Alert not found", 404);
    }

    const alert = await prisma.reorderAlert.findFirst({
      where: { id: alertId, tenantId },
      include: {
        product: { select: { name: true, sku: true, supplier: { select: { name: true } } } },
      },
    });

    if (!alert) {
      return err("REORDER_ALERT_NOT_FOUND", "Alert not found", 404);
    }

    return ok(
      toResponse(alert, alert.product.supplier?.name),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (
      msg === "Unauthorized" ||
      msg === "No organization selected" ||
      msg === "Tenant not found"
    ) {
      return err("UNAUTHORIZED", msg, 401);
    }
    return err("REORDER_ALERT_ACK_FAILED", msg, 400);
  }
}
