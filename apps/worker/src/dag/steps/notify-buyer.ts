import { NOTIFICATION_TRIGGERS } from "@dropflow/config";
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

  const variables: Record<string, string> = {
    buyerName: order.buyerName,
    orderNumber: order.orderNumber,
    totalAmount: (order.totalPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    trackingUrl: "",
    carrier: "",
    discount: "",
    paymentLink: "",
  };

  const basePayload = {
    tenantId: ctx.tenantId,
    orderId: order.id,
    triggerEvent: NOTIFICATION_TRIGGERS.ORDER_CONFIRMED,
    variables,
  };

  const jobOpts = {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  };

  const jobs: Promise<unknown>[] = [];

  if (order.buyerPhone?.trim()) {
    jobs.push(
      notificationQueue.add(
        "order-confirmation",
        {
          ...basePayload,
          channel: "WHATSAPP" as const,
          recipientPhone: order.buyerPhone,
        },
        jobOpts,
      ),
    );
  }

  if (order.buyerEmail?.trim()) {
    jobs.push(
      notificationQueue.add(
        "order-confirmation",
        {
          ...basePayload,
          channel: "EMAIL" as const,
          recipientEmail: order.buyerEmail,
        },
        jobOpts,
      ),
    );
  }

  jobs.push(
    notificationQueue.add(
      "order-confirmation",
      {
        ...basePayload,
        channel: "IN_APP" as const,
      },
      jobOpts,
    ),
  );

  const results = await Promise.all(jobs);
  const firstId = results.find((j) => j && typeof j === "object" && "id" in j && (j as { id?: string }).id != null);
  const jobId = firstId && typeof firstId === "object" && "id" in firstId ? String((firstId as { id?: string }).id) : undefined;

  return {
    success: true,
    data: {
      ...(jobId != null ? { notificationJobId: jobId } : {}),
    },
  };
}
