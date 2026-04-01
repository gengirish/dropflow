import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import type { ReconciliationDashboardKPIs } from "@dropflow/types";
import { ReconciliationStatus } from "@prisma/client";

export async function GET() {
	try {
		const { tenantId } = await getAuthTenant();

		const rows = await prisma.reconciliationRecord.findMany({
			where: { tenantId },
			select: {
				type: true,
				status: true,
				expectedAmountPaise: true,
				actualAmountPaise: true,
				differencePaise: true,
			},
		});

		const totalRecords = rows.length;
		let matchedCount = 0;
		let unmatchedCount = 0;
		let discrepancyCount = 0;

		let totalExpectedPaise = 0;
		let totalActualPaise = 0;

		const byTypeMap = new Map<
			string,
			{ total: number; matched: number; unmatched: number; discrepancy: number }
		>();

		for (const r of rows) {
			totalExpectedPaise += r.expectedAmountPaise;
			totalActualPaise += r.actualAmountPaise;

			if (
				r.status === ReconciliationStatus.MATCHED ||
				r.status === ReconciliationStatus.MANUAL_OVERRIDE
			) {
				matchedCount += 1;
			} else if (r.status === ReconciliationStatus.UNMATCHED) {
				unmatchedCount += 1;
			} else if (r.status === ReconciliationStatus.DISCREPANCY) {
				discrepancyCount += 1;
			}

			let b = byTypeMap.get(r.type);
			if (!b) {
				b = { total: 0, matched: 0, unmatched: 0, discrepancy: 0 };
				byTypeMap.set(r.type, b);
			}
			b.total += 1;
			if (
				r.status === ReconciliationStatus.MATCHED ||
				r.status === ReconciliationStatus.MANUAL_OVERRIDE
			) {
				b.matched += 1;
			} else if (r.status === ReconciliationStatus.UNMATCHED) {
				b.unmatched += 1;
			} else if (r.status === ReconciliationStatus.DISCREPANCY) {
				b.discrepancy += 1;
			}
		}

		const matchRate =
			totalRecords > 0 ? (matchedCount / totalRecords) * 100 : 100;
		const totalDifferencePaise = totalExpectedPaise - totalActualPaise;

		const byType = Array.from(byTypeMap.entries()).map(([type, v]) => ({
			type,
			...v,
		}));

		const data: ReconciliationDashboardKPIs = {
			totalRecords,
			matchedCount,
			unmatchedCount,
			discrepancyCount,
			matchRate,
			totalExpectedPaise,
			totalActualPaise,
			totalDifferencePaise,
			byType,
		};

		return ok(data);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("RECONCILIATION_ANALYTICS_FAILED", msg, 500);
	}
}
