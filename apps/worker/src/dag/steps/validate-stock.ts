import { prisma } from "@dropflow/db";
import type { WorkflowContext, StepResult } from "../types";

export async function validateStock(ctx: WorkflowContext): Promise<StepResult> {
  const order = await prisma.order.findUnique({
    where: { id: ctx.orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  const insufficientStock: string[] = [];

  for (const item of order.items) {
    const available = item.product.stockQty - item.product.reservedQty;
    if (available < item.quantity) {
      insufficientStock.push(
        `${item.product.name} (need ${item.quantity}, available ${available})`,
      );
    }
  }

  if (insufficientStock.length > 0) {
    return {
      success: false,
      error: `Insufficient stock: ${insufficientStock.join(", ")}`,
    };
  }

  for (const item of order.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { reservedQty: { increment: item.quantity } },
    });
  }

  return {
    success: true,
    data: { itemsValidated: order.items.length },
  };
}
