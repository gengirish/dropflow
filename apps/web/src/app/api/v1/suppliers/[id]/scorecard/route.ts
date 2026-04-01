import type { NextRequest } from "next/server";
import { prisma } from "@dropflow/db";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id: supplierId } = await params;
		const sp = req.nextUrl.searchParams;
		const period = sp.get("period") ?? undefined;

		const where = { tenantId, supplierId, ...(period ? { period } : {}) };

		const scorecard = await prisma.supplierScorecard.findFirst({
			where,
			orderBy: { computedAt: "desc" },
			include: { supplier: { select: { name: true, contactEmail: true } } },
		});

		if (!scorecard) {
			return err("SCORECARD_NOT_FOUND", "No scorecard found for this supplier", 404);
		}

		return ok(scorecard);
	} catch (e) {
		return err("SCORECARD_FETCH_FAILED", e instanceof Error ? e.message : "Failed", 500);
	}
}
