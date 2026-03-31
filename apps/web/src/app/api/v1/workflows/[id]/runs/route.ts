import { err, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import type { NextRequest } from "next/server";
import { z } from "zod";

function authError(e: unknown) {
	const msg = e instanceof Error ? e.message : "Unauthorized";
	const status =
		msg === "Unauthorized"
			? 401
			: msg === "No organization selected"
				? 400
				: 400;
	const code = msg === "Unauthorized" ? "UNAUTHORIZED" : "AUTH_FAILED";
	return err(code, msg, status);
}

const Query = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const { id: workflowDefinitionId } = await params;

		const wf = await db.workflowDefinition.findFirst({
			where: { id: workflowDefinitionId },
			select: { id: true },
		});
		if (!wf) {
			return err("NOT_FOUND", "Workflow not found", 404);
		}

		const sp = req.nextUrl.searchParams;
		const { page, pageSize } = Query.parse({
			page: sp.get("page") ?? 1,
			pageSize: sp.get("pageSize") ?? 20,
		});

		const where = { workflowDefinitionId };

		const [items, total] = await Promise.all([
			db.workflowRun.findMany({
				where,
				orderBy: { startedAt: "desc" },
				skip: (page - 1) * pageSize,
				take: pageSize,
				select: {
					id: true,
					status: true,
					triggerId: true,
					currentStep: true,
					startedAt: true,
					completedAt: true,
					failedAt: true,
					errorMessage: true,
					auditLog: true,
				},
			}),
			db.workflowRun.count({ where }),
		]);

		const serialized = items.map((r) => ({
			id: r.id,
			status: r.status,
			triggerId: r.triggerId,
			currentStep: r.currentStep,
			startedAt: r.startedAt.toISOString(),
			completedAt: r.completedAt?.toISOString() ?? null,
			failedAt: r.failedAt?.toISOString() ?? null,
			errorMessage: r.errorMessage,
			auditLog: r.auditLog,
		}));

		return paginated(serialized, total, page, pageSize);
	} catch (e) {
		if (
			e instanceof Error &&
			(e.message === "Unauthorized" || e.message.includes("organization"))
		) {
			return authError(e);
		}
		if (e instanceof z.ZodError) {
			return err(
				"INVALID_QUERY",
				e.errors.map((x) => x.message).join("; "),
				400,
			);
		}
		return err(
			"WORKFLOW_RUNS_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to list workflow runs",
			500,
		);
	}
}
