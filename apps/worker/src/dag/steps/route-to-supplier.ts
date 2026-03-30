import { prisma } from "@dropflow/db";
import type { WorkflowContext, StepResult } from "../types";

export async function routeToSupplier(ctx: WorkflowContext): Promise<StepResult> {
  const order = await prisma.order.findUnique({
    where: { id: ctx.orderId },
    include: { items: { include: { product: { include: { supplier: true } } } } },
  });

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  const supplierIds = [...new Set(order.items.map((item) => item.product.supplierId))];

  if (supplierIds.length === 0) {
    return { success: false, error: "No suppliers found for order items" };
  }

  const primarySupplierId = supplierIds[0]!;
  const supplier = order.items[0]!.product.supplier;

  await prisma.order.update({
    where: { id: ctx.orderId },
    data: { status: "ROUTING" },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId: ctx.orderId,
      tenantId: ctx.tenantId,
      status: "ROUTING",
      note: `Routed to supplier: ${supplier.name}`,
    },
  });

  return {
    success: true,
    data: {
      supplierId: primarySupplierId,
      supplierName: supplier.name,
      supplierCount: supplierIds.length,
    },
  };
}
