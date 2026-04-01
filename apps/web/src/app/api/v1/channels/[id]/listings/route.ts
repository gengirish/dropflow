import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { Prisma, prisma } from "@dropflow/db";
import { BulkListingInput, CreateListingInput } from "@dropflow/types";
import type { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id: channelId } = await context.params;
		const sp = req.nextUrl.searchParams;
		const page = Math.max(1, Number(sp.get("page")) || 1);
		const pageSize = Math.min(
			100,
			Math.max(1, Number(sp.get("pageSize")) || 20),
		);

		const channel = await prisma.salesChannel.findFirst({
			where: { id: channelId, tenantId },
		});
		if (!channel) {
			return err("CHANNEL_NOT_FOUND", "Channel not found", 404);
		}

		const where = { tenantId, channelId };

		const [items, total] = await Promise.all([
			prisma.channelListing.findMany({
				where,
				include: { product: { select: { id: true, sku: true, name: true } } },
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
			prisma.channelListing.count({ where }),
		]);

		return paginated(items, total, page, pageSize);
	} catch (e) {
		return err(
			"LISTINGS_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to fetch listings",
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

		if (body?.listings && Array.isArray(body.listings)) {
			const input = BulkListingInput.parse({ ...body, channelId });
			if (input.channelId !== channelId) {
				return err("CHANNEL_MISMATCH", "channelId must match URL", 400);
			}

			const created = await prisma.$transaction(
				input.listings.map((row) =>
					prisma.channelListing.create({
						data: {
							tenantId,
							channelId,
							productId: row.productId,
							channelSku: row.channelSku,
							channelPricePaise: row.channelPricePaise,
							isActive: true,
						},
						include: {
							product: { select: { id: true, sku: true, name: true } },
						},
					}),
				),
			);

			return ok({ listings: created }, 201);
		}

		const input = CreateListingInput.parse({ ...body, channelId });
		if (input.channelId !== channelId) {
			return err("CHANNEL_MISMATCH", "channelId must match URL", 400);
		}

		const listing = await prisma.channelListing.create({
			data: {
				tenantId,
				channelId,
				productId: input.productId,
				channelSku: input.channelSku,
				channelPricePaise: input.channelPricePaise,
				isActive: input.isActive,
			},
			include: { product: { select: { id: true, sku: true, name: true } } },
		});

		return ok(listing, 201);
	} catch (e) {
		if (
			e instanceof Prisma.PrismaClientKnownRequestError &&
			e.code === "P2002"
		) {
			return err(
				"DUPLICATE_LISTING",
				"This product is already listed on the channel",
				409,
			);
		}
		return err(
			"LISTING_CREATE_FAILED",
			e instanceof Error ? e.message : "Failed to create listing(s)",
			400,
		);
	}
}
