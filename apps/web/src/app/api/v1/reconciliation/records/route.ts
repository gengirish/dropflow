import { err, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { ReconciliationFilters } from "@dropflow/types";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const { searchParams } = new URL(req.url);
		const parsed = ReconciliationFilters.safeParse(
			Object.fromEntries(searchParams.entries()),
		);
		if (!parsed.success) {
			return err("INVALID_FILTERS", parsed.error.message, 400);
		}
		const { type, status, dateFrom, dateTo, page, pageSize } = parsed.data;

		const where: {
			tenantId: string;
			type?: string;
			status?: "MATCHED" | "UNMATCHED" | "DISCREPANCY" | "MANUAL_OVERRIDE";
			createdAt?: { gte?: Date; lte?: Date };
		} = { tenantId };

		if (type) where.type = type;
		if (status) where.status = status;
		if (dateFrom || dateTo) {
			where.createdAt = {};
			if (dateFrom) where.createdAt.gte = new Date(dateFrom);
			if (dateTo) where.createdAt.lte = new Date(dateTo);
		}

		const [total, rows] = await Promise.all([
			prisma.reconciliationRecord.count({ where }),
			prisma.reconciliationRecord.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
		]);

		const items = rows.map((r) => ({
			id: r.id,
			type: r.type,
			referenceId: r.referenceId,
			matchedId: r.matchedId,
			expectedAmountPaise: r.expectedAmountPaise,
			actualAmountPaise: r.actualAmountPaise,
			differencePaise: r.differencePaise,
			status: r.status,
			notes: r.notes,
			resolvedAt: r.resolvedAt?.toISOString() ?? null,
			resolvedBy: r.resolvedBy,
			createdAt: r.createdAt.toISOString(),
		}));

		return paginated(items, total, page, pageSize);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("RECORDS_LIST_FAILED", msg, 500);
	}
}
