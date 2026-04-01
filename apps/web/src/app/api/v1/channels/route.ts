import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import type { ChannelSyncStatus, SalesChannelType } from "@dropflow/db";
import { Prisma, prisma } from "@dropflow/db";
import { ChannelFilters, CreateChannelInput } from "@dropflow/types";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const sp = req.nextUrl.searchParams;
		const filters = ChannelFilters.parse({
			type: sp.get("type") ?? undefined,
			status: sp.get("status") ?? undefined,
			page: sp.get("page") ?? 1,
			pageSize: sp.get("pageSize") ?? 20,
		});

		const conditions: Prisma.SalesChannelWhereInput[] = [{ tenantId }];
		if (filters.type) {
			conditions.push({ type: filters.type as SalesChannelType });
		}
		if (filters.status) {
			conditions.push({ status: filters.status as ChannelSyncStatus });
		}

		const where: Prisma.SalesChannelWhereInput =
			conditions.length === 1 && conditions[0] !== undefined
				? conditions[0]
				: { AND: conditions };

		const [items, total] = await Promise.all([
			prisma.salesChannel.findMany({
				where,
				include: {
					_count: { select: { listings: true, stockAllocations: true } },
				},
				orderBy: { createdAt: "desc" },
				skip: (filters.page - 1) * filters.pageSize,
				take: filters.pageSize,
			}),
			prisma.salesChannel.count({ where }),
		]);

		return paginated(items, total, filters.page, filters.pageSize);
	} catch (e) {
		return err(
			"CHANNELS_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to fetch channels",
			500,
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const body = await req.json();
		const input = CreateChannelInput.parse(body);

		const channel = await prisma.salesChannel.create({
			data: {
				tenantId,
				name: input.name,
				type: input.type,
				credentials: (input.credentials ?? {}) as Prisma.InputJsonValue,
				bufferPercent: input.bufferPercent,
				configJson: (input.configJson ?? {}) as Prisma.InputJsonValue,
				status: "DISCONNECTED",
			},
		});

		return ok(channel, 201);
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
			"CHANNEL_CREATE_FAILED",
			e instanceof Error ? e.message : "Failed to create channel",
			400,
		);
	}
}
