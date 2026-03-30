import type { NextRequest } from "next/server";
import { prisma } from "@dropflow/db";
import { UpdateOrderStatusInput } from "@dropflow/types";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId, userId } = await getAuthTenant();
		const { id } = await params;
		const body = await req.json();
		const input = UpdateOrderStatusInput.parse(body);

		const order = await prisma.order.findFirst({ where: { id, tenantId } });
		if (!order) return err("NOT_FOUND", "Order not found", 404);

		const updated = await prisma.order.update({
			where: { id, tenantId },
			data: { status: input.status },
		});

		await prisma.orderStatusHistory.create({
			data: {
				orderId: id,
				tenantId,
				status: input.status,
				note: input.note,
				actorId: userId,
			},
		});

		return ok(updated);
	} catch (e) {
		return err("STATUS_UPDATE_FAILED", e instanceof Error ? e.message : "Failed", 400);
	}
}
