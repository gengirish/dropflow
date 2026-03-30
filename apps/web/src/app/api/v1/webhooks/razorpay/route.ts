import crypto from "node:crypto";
import type { Currency } from "@dropflow/db";
import { prisma } from "@dropflow/db";
import { type NextRequest, NextResponse } from "next/server";

function paymentCurrency(value: unknown): Currency {
	const u = String(value ?? "INR").toUpperCase();
	if (u === "INR" || u === "USD" || u === "EUR" || u === "GBP") {
		return u;
	}
	return "INR";
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.text();
		const signature = req.headers.get("x-razorpay-signature");
		const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

		if (!signature || !webhookSecret) {
			return NextResponse.json({ error: "Missing signature" }, { status: 400 });
		}

		const expected = crypto
			.createHmac("sha256", webhookSecret)
			.update(body)
			.digest("hex");

		if (expected !== signature) {
			return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
		}

		const event = JSON.parse(body) as {
			event: string;
			payload: {
				payment?: { entity: Record<string, unknown> };
				refund?: { entity: Record<string, unknown> };
			};
		};
		const eventType = event.event;

		if (eventType === "payment.captured") {
			const payment = event.payload.payment?.entity;
			if (!payment || typeof payment !== "object") {
				return NextResponse.json(
					{ error: "Invalid payment payload" },
					{ status: 400 },
				);
			}
			const p = payment as Record<string, unknown>;
			const notes = (p.notes ?? {}) as Record<string, string>;
			const orderId = notes.orderId;
			const tenantId = notes.tenantId;

			if (!orderId || !tenantId) {
				return NextResponse.json(
					{ error: "Missing order context" },
					{ status: 400 },
				);
			}

			await prisma.payment.create({
				data: {
					orderId,
					tenantId,
					gateway: "RAZORPAY",
					gatewayPaymentId: String(p.id),
					gatewayOrderId: p.order_id != null ? String(p.order_id) : null,
					amountPaise: Number(p.amount),
					currency: paymentCurrency(p.currency),
					status: "CAPTURED",
					capturedAt: new Date(),
					metaJson: {
						method: p.method != null ? String(p.method) : null,
						email: p.email != null ? String(p.email) : null,
					},
				},
			});

			await prisma.order.update({
				where: { id: orderId },
				data: { status: "PAYMENT_CONFIRMED" },
			});

			await prisma.orderStatusHistory.create({
				data: {
					orderId,
					tenantId,
					status: "PAYMENT_CONFIRMED",
					note: `Payment captured via Razorpay: ${p.id}`,
				},
			});

			const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
			const workerSecret =
				process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

			try {
				await fetch(`${workerUrl}/internal/enqueue`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-worker-secret": workerSecret,
					},
					body: JSON.stringify({
						queue: "order-queue",
						payload: { tenantId, orderId },
					}),
				});
			} catch (enqueueError) {
				console.error("Failed to enqueue after payment:", enqueueError);
			}
		}

		if (eventType === "refund.processed") {
			const refund = event.payload.refund?.entity as Record<string, unknown>;
			const paymentId =
				refund?.payment_id != null ? String(refund.payment_id) : "";

			if (paymentId) {
				await prisma.payment.updateMany({
					where: { gatewayPaymentId: paymentId },
					data: { status: "REFUNDED", refundedAt: new Date() },
				});
			}
		}

		return NextResponse.json({ received: true });
	} catch (e) {
		console.error("Razorpay webhook error:", e);
		return NextResponse.json(
			{ error: "Webhook processing failed" },
			{ status: 500 },
		);
	}
}
