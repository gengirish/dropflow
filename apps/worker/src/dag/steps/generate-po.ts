import { prisma } from "@dropflow/db";
import type { WorkflowContext, StepResult } from "../types";

function generatePONumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO/${yy}${mm}/${rand}`;
}

export async function generatePO(ctx: WorkflowContext): Promise<StepResult> {
  const order = await prisma.order.findUnique({
    where: { id: ctx.orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  const supplierId =
    (ctx.data.supplierId as string) || order.items[0]?.product.supplierId;

  if (!supplierId) {
    return { success: false, error: "No supplier ID available" };
  }

  const totalPaise = order.items.reduce((sum, item) => sum + item.totalPaise, 0);

  const po = await prisma.purchaseOrder.create({
    data: {
      orderId: ctx.orderId,
      tenantId: ctx.tenantId,
      supplierId,
      poNumber: generatePONumber(),
      totalPaise,
      status: "SENT",
      sentAt: new Date(),
    },
  });

  await prisma.order.update({
    where: { id: ctx.orderId },
    data: { status: "PO_CREATED" },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId: ctx.orderId,
      tenantId: ctx.tenantId,
      status: "PO_CREATED",
      note: `Purchase order ${po.poNumber} sent to supplier`,
    },
  });

  return {
    success: true,
    data: { poId: po.id, poNumber: po.poNumber },
  };
}
