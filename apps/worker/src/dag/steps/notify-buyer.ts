import { prisma } from "@dropflow/db";
import { notificationQueue } from "../../queues";
import type { WorkflowContext, StepResult } from "../types";

export async function notifyBuyer(ctx: WorkflowContext): Promise<StepResult> {
  const order = await prisma.order.findUnique({
    where: { id: ctx.orderId },
    include: {
      items: { include: { product: true } },
    },
  });

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  const job = await notificationQueue.add(
    "order-confirmation",
    {
      tenantId: ctx.tenantId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      buyerPhone: order.buyerPhone,
      totalPaise: order.totalPaise,
      currency: order.currency,
      items: order.items.map((item) => ({
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        quantity: item.quantity,
        lineTotalPaise: item.totalPaise,
      })),
    },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  return {
    success: true,
    data: {
      ...(job.id != null ? { notificationJobId: String(job.id) } : {}),
    },
  };
}
