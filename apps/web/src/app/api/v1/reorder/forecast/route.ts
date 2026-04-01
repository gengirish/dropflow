import { prisma } from "@dropflow/db";
import type { StockForecast } from "@dropflow/types";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

function forecastStatus(
  availableStock: number,
  salesVelocityDaily: number,
  reorderPoint: number,
  supplierLeadTimeDays: number,
): StockForecast["status"] {
  const daysRemaining =
    salesVelocityDaily > 0 ? availableStock / salesVelocityDaily : availableStock <= 0 ? 0 : 999;

  if (daysRemaining <= 0 || availableStock <= 0) return "STOCKOUT";
  if (daysRemaining <= supplierLeadTimeDays) return "CRITICAL";

  const reorderPointDaysCover =
    salesVelocityDaily > 0 ? reorderPoint / salesVelocityDaily : 999;

  if (daysRemaining <= reorderPointDaysCover) return "WARNING";
  return "OK";
}

function stockoutDateISO(daysRemaining: number): string | null {
  if (!Number.isFinite(daysRemaining) || daysRemaining >= 999) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.ceil(daysRemaining)));
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const { tenantId } = await getAuthTenant();

    const rules = await prisma.reorderRule.findMany({
      where: { tenantId },
      include: {
        product: {
          include: { supplier: true },
        },
      },
    });

    const forecasts: StockForecast[] = rules.map((rule) => {
      const p = rule.product;
      const available = p.stockQty - p.reservedQty;
      const velocity = p.salesVelocityDaily;
      const daysOfStockRemaining =
        velocity > 0 ? available / velocity : available <= 0 ? 0 : 999;

      const supplierLeadTimeDays =
        rule.leadTimeDays ?? p.supplier.leadTimeDays;

      const status = forecastStatus(
        available,
        velocity,
        rule.reorderPoint,
        supplierLeadTimeDays,
      );

      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        currentStock: available,
        salesVelocityDaily: velocity,
        daysOfStockRemaining,
        reorderPoint: rule.reorderPoint,
        reorderQty: rule.reorderQty,
        supplierLeadTimeDays,
        stockoutDate: stockoutDateISO(daysOfStockRemaining),
        status,
      };
    });

    return ok(forecasts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (
      msg === "Unauthorized" ||
      msg === "No organization selected" ||
      msg === "Tenant not found"
    ) {
      return err("UNAUTHORIZED", msg, 401);
    }
    return err("REORDER_FORECAST_FAILED", msg, 500);
  }
}
