import type { NextRequest } from "next/server";
import { prisma } from "@dropflow/db";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await params;

		const order = await prisma.order.findFirst({
			where: { id, tenantId },
			include: {
				items: {
					include: {
						product: {
							select: {
								id: true,
								name: true,
								sku: true,
								hsnCode: true,
								supplier: { select: { id: true, name: true } },
							},
						},
					},
				},
				purchaseOrder: true,
				invoice: true,
				shipment: { include: { trackingEvents: { orderBy: { eventTime: "desc" } } } },
				payments: { orderBy: { createdAt: "desc" } },
				statusHistory: { orderBy: { createdAt: "desc" } },
			},
		});

		if (!order) {
			return err("NOT_FOUND", "Order not found", 404);
		}

		let workflowRun = null;
		if (order.workflowRunId) {
			workflowRun = await prisma.workflowRun.findUnique({
				where: { id: order.workflowRunId },
				include: {
					workflowDef: { select: { name: true, dagJson: true } },
				},
			});
		}

		return ok({ ...order, workflowRun });
	} catch (e) {
		return err("ORDER_FETCH_FAILED", e instanceof Error ? e.message : "Failed", 500);
	}
}
