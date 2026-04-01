import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import type { ChannelInventorySnapshot } from "@dropflow/types";
import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();

		const [products, channels] = await Promise.all([
			prisma.product.findMany({
				where: { tenantId, isActive: true },
				select: { id: true, name: true, sku: true, stockQty: true },
				orderBy: { name: "asc" },
			}),
			prisma.salesChannel.findMany({
				where: { tenantId },
				select: { id: true, name: true, type: true, bufferPercent: true },
				orderBy: { name: "asc" },
			}),
		]);

		const allocations = await prisma.channelStockAllocation.findMany({
			where: { tenantId },
		});

		const allocByProduct = new Map<
			string,
			Map<
				string,
				{ allocatedQty: number; reservedQty: number; bufferPercent: number }
			>
		>();

		for (const a of allocations) {
			const ch = channels.find((c) => c.id === a.channelId);
			const bp = ch?.bufferPercent ?? 100;
			let m = allocByProduct.get(a.productId);
			if (!m) {
				m = new Map();
				allocByProduct.set(a.productId, m);
			}
			m.set(a.channelId, {
				allocatedQty: a.allocatedQty,
				reservedQty: a.reservedQty,
				bufferPercent: bp,
			});
		}

		const snapshots: ChannelInventorySnapshot[] = products.map((p) => {
			const channelRows = channels.map((ch) => {
				const row = allocByProduct.get(p.id)?.get(ch.id);
				const allocated = row?.allocatedQty ?? 0;
				const reserved = row?.reservedQty ?? 0;
				const bufferPercent = ch.bufferPercent;
				const available = allocated;
				const visibleStock = Math.max(
					0,
					Math.floor((allocated * bufferPercent) / 100) - reserved,
				);
				return {
					channelId: ch.id,
					channelName: ch.name,
					channelType: ch.type,
					allocated,
					reserved,
					available,
					bufferPercent,
					visibleStock,
				};
			});

			const assignedTotal = allocations
				.filter((a) => a.productId === p.id)
				.reduce((s, a) => s + a.allocatedQty + a.reservedQty, 0);

			const unallocated = Math.max(0, p.stockQty - assignedTotal);

			return {
				productId: p.id,
				productName: p.name,
				sku: p.sku,
				totalStock: p.stockQty,
				channels: channelRows,
				unallocated,
			};
		});

		return ok(snapshots);
	} catch (e) {
		return err(
			"INVENTORY_SNAPSHOT_FAILED",
			e instanceof Error ? e.message : "Failed to build inventory snapshot",
			500,
		);
	}
}
