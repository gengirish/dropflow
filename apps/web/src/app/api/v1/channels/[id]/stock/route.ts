import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { Prisma, prisma } from "@dropflow/db";
import {
	BulkStockAllocationInput,
	StockAllocationInput,
} from "@dropflow/types";
import type { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id: channelId } = await context.params;

		const channel = await prisma.salesChannel.findFirst({
			where: { id: channelId, tenantId },
		});
		if (!channel) {
			return err("CHANNEL_NOT_FOUND", "Channel not found", 404);
		}

		const allocations = await prisma.channelStockAllocation.findMany({
			where: { tenantId, channelId },
			include: {
				product: {
					select: { id: true, sku: true, name: true, stockQty: true },
				},
			},
			orderBy: { product: { name: "asc" } },
		});

		return ok(allocations);
	} catch (e) {
		return err(
			"STOCK_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to fetch stock allocations",
			500,
		);
	}
}

export async function POST(req: NextRequest, context: RouteContext) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id: channelId } = await context.params;
		const body = await req.json();

		const channel = await prisma.salesChannel.findFirst({
			where: { id: channelId, tenantId },
		});
		if (!channel) {
			return err("CHANNEL_NOT_FOUND", "Channel not found", 404);
		}

		if (body?.allocations && Array.isArray(body.allocations)) {
			const input = BulkStockAllocationInput.parse({ ...body, channelId });
			if (input.channelId !== channelId) {
				return err("CHANNEL_MISMATCH", "channelId must match URL", 400);
			}

			const results = await prisma.$transaction(
				input.allocations.map((row) =>
					prisma.channelStockAllocation.upsert({
						where: {
							channelId_productId: { channelId, productId: row.productId },
						},
						create: {
							tenantId,
							channelId,
							productId: row.productId,
							allocatedQty: row.allocatedQty,
						},
						update: { allocatedQty: row.allocatedQty },
						include: {
							product: { select: { id: true, sku: true, name: true } },
						},
					}),
				),
			);

			return ok({ allocations: results });
		}

		const input = StockAllocationInput.parse({ ...body, channelId });
		if (input.channelId !== channelId) {
			return err("CHANNEL_MISMATCH", "channelId must match URL", 400);
		}

		const product = await prisma.product.findFirst({
			where: { id: input.productId, tenantId },
		});
		if (!product) {
			return err("PRODUCT_NOT_FOUND", "Product not found", 404);
		}

		const allocation = await prisma.channelStockAllocation.upsert({
			where: {
				channelId_productId: { channelId, productId: input.productId },
			},
			create: {
				tenantId,
				channelId,
				productId: input.productId,
				allocatedQty: input.allocatedQty,
			},
			update: { allocatedQty: input.allocatedQty },
			include: { product: { select: { id: true, sku: true, name: true } } },
		});

		return ok(allocation);
	} catch (e) {
		if (
			e instanceof Prisma.PrismaClientKnownRequestError &&
			e.code === "P2002"
		) {
			return err("STOCK_UPSERT_FAILED", "Could not save allocation", 409);
		}
		return err(
			"STOCK_SAVE_FAILED",
			e instanceof Error ? e.message : "Failed to save stock allocation(s)",
			400,
		);
	}
}
