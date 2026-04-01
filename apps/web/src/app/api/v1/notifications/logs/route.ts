import { err, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { type Prisma, prisma } from "@dropflow/db";
import { NotificationLogFilters } from "@dropflow/types";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const sp = req.nextUrl.searchParams;

		const filters = NotificationLogFilters.parse({
			channel: sp.get("channel") ?? undefined,
			status: sp.get("status") ?? undefined,
			orderId: sp.get("orderId") ?? undefined,
			dateFrom: sp.get("dateFrom") ?? undefined,
			dateTo: sp.get("dateTo") ?? undefined,
			page: sp.get("page") ?? 1,
			pageSize: sp.get("pageSize") ?? 20,
		});

		const where: Prisma.NotificationLogWhereInput = { tenantId };

		if (filters.channel) where.channel = filters.channel;
		if (filters.status) where.status = filters.status;
		if (filters.orderId) where.orderId = filters.orderId;

		if (filters.dateFrom || filters.dateTo) {
			where.createdAt = {};
			if (filters.dateFrom) {
				where.createdAt.gte = new Date(filters.dateFrom);
			}
			if (filters.dateTo) {
				where.createdAt.lte = new Date(filters.dateTo);
			}
		}

		const [total, rows] = await prisma.$transaction([
			prisma.notificationLog.count({ where }),
			prisma.notificationLog.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (filters.page - 1) * filters.pageSize,
				take: filters.pageSize,
				include: {
					template: { select: { name: true, triggerEvent: true } },
				},
			}),
		]);

		return paginated(rows, total, filters.page, filters.pageSize);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("NOTIFICATION_LOGS_FETCH_FAILED", msg, 500);
	}
}
