import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { ReturnDashboardKPIs } from "@dropflow/types";
import type { NextRequest } from "next/server";

const PENDING_STATUSES = [
	"REQUESTED",
	"APPROVED",
	"PICKUP_SCHEDULED",
	"PICKED_UP",
	"RECEIVED",
	"QC_PASSED",
	"QC_FAILED",
	"RESTOCKED",
	"DISPOSED",
	"REFUND_INITIATED",
] as const;

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
		const windowDays =
			Number.isFinite(days) && days > 0 && days <= 365 ? days : 30;

		const since = new Date();
		since.setDate(since.getDate() - windowDays);

		const [
			totalReturns,
			pendingReturns,
			ordersInWindow,
			completedReturns,
			refundedAgg,
			qcPassed,
			qcFailed,
			reasonGroups,
			restockCandidates,
		] = await Promise.all([
			prisma.returnRequest.count({
				where: { tenantId, createdAt: { gte: since } },
			}),
			prisma.returnRequest.count({
				where: {
					tenantId,
					createdAt: { gte: since },
					status: { in: [...PENDING_STATUSES] },
				},
			}),
			prisma.order.count({
				where: { tenantId, createdAt: { gte: since } },
			}),
			prisma.returnRequest.findMany({
				where: {
					tenantId,
					createdAt: { gte: since },
					status: { in: ["REFUND_COMPLETED", "REJECTED"] },
				},
				select: { createdAt: true, updatedAt: true },
			}),
			prisma.refund.aggregate({
				where: {
					tenantId,
					status: "COMPLETED",
					createdAt: { gte: since },
				},
				_sum: { amountPaise: true },
			}),
			prisma.returnRequest.count({
				where: { tenantId, createdAt: { gte: since }, status: "QC_PASSED" },
			}),
			prisma.returnRequest.count({
				where: { tenantId, createdAt: { gte: since }, status: "QC_FAILED" },
			}),
			prisma.returnRequest.groupBy({
				by: ["reason"],
				where: { tenantId, createdAt: { gte: since } },
				_count: { id: true },
			}),
			prisma.returnRequest.findMany({
				where: {
					tenantId,
					createdAt: { gte: since },
					status: { in: ["QC_PASSED", "REFUND_COMPLETED", "REFUND_INITIATED"] },
				},
				include: {
					items: { select: { restocked: true, quantity: true } },
				},
			}),
		]);

		const returnRate =
			ordersInWindow > 0 ? (totalReturns / ordersInWindow) * 100 : 0;

		let avgResolutionDays = 0;
		if (completedReturns.length > 0) {
			const sumMs = completedReturns.reduce((acc, r) => {
				return acc + (r.updatedAt.getTime() - r.createdAt.getTime());
			}, 0);
			avgResolutionDays =
				sumMs / completedReturns.length / (24 * 60 * 60 * 1000);
		}

		const qcTotal = qcPassed + qcFailed;
		const qcPassRate = qcTotal > 0 ? (qcPassed / qcTotal) * 100 : 0;

		let restockedFull = 0;
		for (const r of restockCandidates) {
			if (r.items.length === 0) continue;
			const all = r.items.every((i) => i.restocked);
			if (all) restockedFull += 1;
		}
		const restockRate =
			restockCandidates.length > 0
				? (restockedFull / restockCandidates.length) * 100
				: 0;

		const reasonTotal = reasonGroups.reduce((a, g) => a + g._count.id, 0);
		const topReturnReasons = reasonGroups
			.map((g) => ({
				reason: g.reason,
				count: g._count.id,
				percent: reasonTotal > 0 ? (g._count.id / reasonTotal) * 100 : 0,
			}))
			.sort((a, b) => b.count - a.count);

		const payload = ReturnDashboardKPIs.parse({
			totalReturns,
			pendingReturns,
			returnRate,
			avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
			totalRefundedPaise: refundedAgg._sum.amountPaise ?? 0,
			qcPassRate: Math.round(qcPassRate * 10) / 10,
			restockRate: Math.round(restockRate * 10) / 10,
			topReturnReasons,
		});

		return ok(payload);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("RETURNS_ANALYTICS_FAILED", msg, 500);
	}
}
