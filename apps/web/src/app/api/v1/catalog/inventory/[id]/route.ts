import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { UpdateInventoryInput } from "@dropflow/types";
import type { NextRequest } from "next/server";

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const { id } = await params;
		const body = await req.json();
		const input = UpdateInventoryInput.parse(body);

		const product = await db.product.findFirst({ where: { id } });
		if (!product) {
			return err("NOT_FOUND", "Product not found", 404);
		}

		let newStockQty: number;
		if (input.stockQty !== undefined) {
			newStockQty = input.stockQty;
		} else if (input.delta !== undefined) {
			newStockQty = product.stockQty + input.delta;
		} else {
			return err("INVALID_INPUT", "Provide either stockQty or delta", 400);
		}

		if (newStockQty < 0) {
			return err("INSUFFICIENT_STOCK", "Stock cannot go below zero", 400);
		}

		const updated = await db.product.update({
			where: { id },
			data: { stockQty: newStockQty },
		});

		return ok({
			id: updated.id,
			sku: updated.sku,
			stockQty: updated.stockQty,
			previousStockQty: product.stockQty,
			reason: input.reason,
		});
	} catch (e) {
		return err(
			"INVENTORY_UPDATE_FAILED",
			e instanceof Error ? e.message : "Failed to update inventory",
			400,
		);
	}
}
