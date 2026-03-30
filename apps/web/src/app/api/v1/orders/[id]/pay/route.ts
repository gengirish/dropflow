import type { NextRequest } from "next/server";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { ok, err } from "@/lib/api-response";
import { createRazorpayOrder } from "@/lib/razorpay";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await getAuthTenant();
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId },
    });

    if (!order) return err("NOT_FOUND", "Order not found", 404);
    if (order.status !== "PENDING") {
      return err("INVALID_STATE", "Order is not in PENDING state", 400);
    }

    const razorpayOrder = await createRazorpayOrder({
      amountPaise: order.totalPaise,
      currency: order.currency,
      receipt: order.orderNumber,
      notes: { orderId: order.id, tenantId },
    });

    await prisma.order.update({
      where: { id },
      data: { status: "PAYMENT_PENDING" },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        tenantId,
        status: "PAYMENT_PENDING",
        note: "Razorpay checkout initiated",
      },
    });

    return ok({
      razorpayOrderId: razorpayOrder.id,
      amountPaise: order.totalPaise,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (e) {
    return err("PAYMENT_INIT_FAILED", e instanceof Error ? e.message : "Failed", 500);
  }
}
