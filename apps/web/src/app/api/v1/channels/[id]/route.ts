import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { Prisma, prisma } from "@dropflow/db";
import { UpdateChannelInput } from "@dropflow/types";
import type { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await context.params;

		const channel = await prisma.salesChannel.findFirst({
			where: { id, tenantId },
			include: {
				_count: {
					select: { listings: true, stockAllocations: true, orders: true },
				},
			},
		});

		if (!channel) {
			return err("CHANNEL_NOT_FOUND", "Channel not found", 404);
		}

		return ok(channel);
	} catch (e) {
		return err(
			"CHANNEL_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to fetch channel",
			500,
		);
	}
}

export async function PATCH(req: NextRequest, context: RouteContext) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await context.params;
		const body = await req.json();
		const input = UpdateChannelInput.parse(body);

		const existing = await prisma.salesChannel.findFirst({
			where: { id, tenantId },
		});
		if (!existing) {
			return err("CHANNEL_NOT_FOUND", "Channel not found", 404);
		}

		const data: Prisma.SalesChannelUpdateInput = {};
		if (input.name !== undefined) data.name = input.name;
		if (input.type !== undefined) data.type = input.type;
		if (input.credentials !== undefined) {
			data.credentials = input.credentials as Prisma.InputJsonValue;
		}
		if (input.bufferPercent !== undefined)
			data.bufferPercent = input.bufferPercent;
		if (input.configJson !== undefined) {
			data.configJson = input.configJson as Prisma.InputJsonValue;
		}

		const channel = await prisma.salesChannel.update({
			where: { id },
			data,
		});

		return ok(channel);
	} catch (e) {
		if (
			e instanceof Prisma.PrismaClientKnownRequestError &&
			e.code === "P2002"
		) {
			return err(
				"DUPLICATE_CHANNEL",
				"A channel with this type and name already exists",
				409,
			);
		}
		return err(
			"CHANNEL_UPDATE_FAILED",
			e instanceof Error ? e.message : "Failed to update channel",
			400,
		);
	}
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await context.params;

		const existing = await prisma.salesChannel.findFirst({
			where: { id, tenantId },
		});
		if (!existing) {
			return err("CHANNEL_NOT_FOUND", "Channel not found", 404);
		}

		await prisma.$transaction(async (tx) => {
			await tx.order.updateMany({
				where: { tenantId, channelId: id },
				data: { channelId: null },
			});
			await tx.channelListing.deleteMany({
				where: { tenantId, channelId: id },
			});
			await tx.channelStockAllocation.deleteMany({
				where: { tenantId, channelId: id },
			});
			await tx.salesChannel.delete({ where: { id } });
		});

		return ok({ deleted: true });
	} catch (e) {
		return err(
			"CHANNEL_DELETE_FAILED",
			e instanceof Error ? e.message : "Failed to delete channel",
			400,
		);
	}
}
