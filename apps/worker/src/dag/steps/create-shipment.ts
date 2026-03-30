import { prisma } from "@dropflow/db";
import type { WorkflowContext, StepResult } from "../types";

export async function createShipment(ctx: WorkflowContext): Promise<StepResult> {
  const order = await prisma.order.findUnique({
    where: { id: ctx.orderId },
    include: { items: true },
  });

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  const existingShipment = await prisma.shipment.findUnique({
    where: { orderId: ctx.orderId },
  });

  if (existingShipment) {
    return {
      success: true,
      data: { shipmentId: existingShipment.id, status: "already_exists" },
    };
  }

  const shipment = await prisma.shipment.create({
    data: {
      orderId: ctx.orderId,
      tenantId: ctx.tenantId,
      carrier: "SELF",
      trackingStatus: "PENDING",
    },
  });

  await prisma.order.update({
    where: { id: ctx.orderId },
    data: { status: "PROCESSING" },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId: ctx.orderId,
      tenantId: ctx.tenantId,
      status: "PROCESSING",
      note: "Shipment created, awaiting carrier assignment",
    },
  });

  return {
    success: true,
    data: { shipmentId: shipment.id },
  };
}
