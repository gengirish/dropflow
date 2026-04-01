import type { NextRequest } from "next/server";
import { prisma } from "@dropflow/db";
import { CreateReorderRuleInput } from "@dropflow/types";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

export async function GET() {
  try {
    const { tenantId } = await getAuthTenant();

    const rules = await prisma.reorderRule.findMany({
      where: { tenantId },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            stockQty: true,
            reservedQty: true,
            salesVelocityDaily: true,
            reorderPoint: true,
            supplierId: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return ok(rules);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (
      msg === "Unauthorized" ||
      msg === "No organization selected" ||
      msg === "Tenant not found"
    ) {
      return err("UNAUTHORIZED", msg, 401);
    }
    return err("REORDER_RULES_FETCH_FAILED", msg, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const body = await req.json();
    const input = CreateReorderRuleInput.parse(body);

    const product = await prisma.product.findFirst({
      where: { id: input.productId, tenantId },
    });
    if (!product) {
      return err("PRODUCT_NOT_FOUND", "Product not found for tenant", 404);
    }

    const rule = await prisma.reorderRule.upsert({
      where: { productId: input.productId },
      create: {
        tenantId,
        productId: input.productId,
        reorderPoint: input.reorderPoint,
        reorderQty: input.reorderQty,
        maxStockQty: input.maxStockQty,
        leadTimeDays: input.leadTimeDays ?? null,
        isAutoPoEnabled: input.isAutoPoEnabled,
      },
      update: {
        reorderPoint: input.reorderPoint,
        reorderQty: input.reorderQty,
        maxStockQty: input.maxStockQty,
        ...(input.leadTimeDays !== undefined
          ? { leadTimeDays: input.leadTimeDays ?? null }
          : {}),
        isAutoPoEnabled: input.isAutoPoEnabled,
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            stockQty: true,
            reservedQty: true,
            salesVelocityDaily: true,
            reorderPoint: true,
            supplierId: true,
          },
        },
      },
    });

    return ok(rule, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (
      msg === "Unauthorized" ||
      msg === "No organization selected" ||
      msg === "Tenant not found"
    ) {
      return err("UNAUTHORIZED", msg, 401);
    }
    return err("REORDER_RULE_UPSERT_FAILED", msg, 400);
  }
}
