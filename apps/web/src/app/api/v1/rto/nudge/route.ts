import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@dropflow/db";
import { RtoNudgeInput } from "@dropflow/types";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

async function enqueueRtoJob(jobName: string, payload: Record<string, unknown>) {
  const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
  const workerSecret = process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

  const res = await fetch(`${workerUrl}/internal/enqueue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": workerSecret,
    },
    body: JSON.stringify({
      queue: "rto-queue",
      jobName,
      payload,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Enqueue failed: ${res.status}`);
  }

  return res.json() as Promise<{ jobId?: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const body = await req.json();
    const input = RtoNudgeInput.parse(body);

    const order = await prisma.order.findFirst({
      where: { id: input.orderId, tenantId },
      select: { id: true },
    });
    if (!order) {
      return err("ORDER_NOT_FOUND", "Order not found", 404);
    }

    const { jobId } = await enqueueRtoJob("send-nudge", {
      tenantId,
      orderId: input.orderId,
      channel: input.channel,
    });
    return ok({ jobId, orderId: input.orderId, channel: input.channel }, 202);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (
      msg === "Unauthorized" ||
      msg === "No organization selected" ||
      msg === "Tenant not found"
    ) {
      return err("UNAUTHORIZED", msg, 401);
    }
    if (e instanceof ZodError) {
      return err("VALIDATION_ERROR", e.message, 400);
    }
    return err("RTO_NUDGE_ENQUEUE_FAILED", msg, 400);
  }
}
