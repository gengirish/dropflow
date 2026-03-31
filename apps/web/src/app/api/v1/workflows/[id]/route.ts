import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { reactFlowToDagNodes } from "@/lib/workflow-dag";
import type { Prisma } from "@dropflow/db";
import type { Edge, Node } from "@xyflow/react";
import type { NextRequest } from "next/server";
import { z } from "zod";

const PutBody = z.object({
	nodes: z.array(z.any()),
	edges: z.array(z.any()),
});

const PatchBody = z.object({
	status: z.enum(["ACTIVE", "PAUSED"]),
});

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

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const { id } = await params;

		const wf = await db.workflowDefinition.findFirst({
			where: { id },
		});
		if (!wf) {
			return err("NOT_FOUND", "Workflow not found", 404);
		}

		const since = new Date(Date.now() - RECENT_MS);

		const [recentRunsCount, lastRun, totalRuns] = await Promise.all([
			db.workflowRun.count({
				where: { workflowDefinitionId: id, startedAt: { gte: since } },
			}),
			db.workflowRun.findFirst({
				where: { workflowDefinitionId: id },
				orderBy: { startedAt: "desc" },
				select: {
					id: true,
					status: true,
					startedAt: true,
					completedAt: true,
					failedAt: true,
				},
			}),
			db.workflowRun.count({
				where: { workflowDefinitionId: id },
			}),
		]);

		return ok({
			id: wf.id,
			name: wf.name,
			trigger: wf.trigger,
			version: wf.version,
			status: wf.status,
			dagJson: wf.dagJson,
			configJson: wf.configJson,
			createdAt: wf.createdAt.toISOString(),
			updatedAt: wf.updatedAt.toISOString(),
			totalRuns,
			recentRunsCount,
			lastRun: lastRun
				? {
						id: lastRun.id,
						status: lastRun.status,
						startedAt: lastRun.startedAt.toISOString(),
						completedAt: lastRun.completedAt?.toISOString() ?? null,
						failedAt: lastRun.failedAt?.toISOString() ?? null,
					}
				: null,
		});
	} catch (e) {
		if (
			e instanceof Error &&
			(e.message === "Unauthorized" || e.message.includes("organization"))
		) {
			return authError(e);
		}
		return err(
			"WORKFLOW_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to fetch workflow",
			500,
		);
	}
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const { id } = await params;

		const existing = await db.workflowDefinition.findFirst({ where: { id } });
		if (!existing) {
			return err("NOT_FOUND", "Workflow not found", 404);
		}
		if (existing.status === "ARCHIVED") {
			return err("ARCHIVED", "Cannot edit an archived workflow", 409);
		}

		const json = await req.json();
		const body = PutBody.parse(json);

		const converted = reactFlowToDagNodes(
			body.nodes as Node[],
			body.edges as Edge[],
		);
		if (!converted.ok) {
			return err(converted.error.code, converted.error.message, 422);
		}

		const dagJson = {
			nodes: converted.dag,
		} as unknown as Prisma.InputJsonValue;

		const updated = await db.workflowDefinition.update({
			where: { id },
			data: { dagJson },
		});

		return ok({
			id: updated.id,
			name: updated.name,
			trigger: updated.trigger,
			version: updated.version,
			status: updated.status,
			dagJson: updated.dagJson,
			configJson: updated.configJson,
			updatedAt: updated.updatedAt.toISOString(),
		});
	} catch (e) {
		if (
			e instanceof Error &&
			(e.message === "Unauthorized" || e.message.includes("organization"))
		) {
			return authError(e);
		}
		if (e instanceof z.ZodError) {
			return err(
				"INVALID_BODY",
				e.errors.map((x) => x.message).join("; "),
				400,
			);
		}
		return err(
			"WORKFLOW_UPDATE_FAILED",
			e instanceof Error ? e.message : "Failed to update workflow",
			400,
		);
	}
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const { id } = await params;

		const existing = await db.workflowDefinition.findFirst({ where: { id } });
		if (!existing) {
			return err("NOT_FOUND", "Workflow not found", 404);
		}
		if (existing.status === "ARCHIVED") {
			return err(
				"ARCHIVED",
				"Cannot change status of an archived workflow",
				409,
			);
		}

		const json = await req.json();
		const { status } = PatchBody.parse(json);

		const updated = await db.workflowDefinition.update({
			where: { id },
			data: { status },
		});

		return ok({
			id: updated.id,
			status: updated.status,
			updatedAt: updated.updatedAt.toISOString(),
		});
	} catch (e) {
		if (
			e instanceof Error &&
			(e.message === "Unauthorized" || e.message.includes("organization"))
		) {
			return authError(e);
		}
		if (e instanceof z.ZodError) {
			return err(
				"INVALID_BODY",
				e.errors.map((x) => x.message).join("; "),
				400,
			);
		}
		return err(
			"WORKFLOW_PATCH_FAILED",
			e instanceof Error ? e.message : "Failed to update workflow status",
			400,
		);
	}
}

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const { id } = await params;

		const existing = await db.workflowDefinition.findFirst({ where: { id } });
		if (!existing) {
			return err("NOT_FOUND", "Workflow not found", 404);
		}

		const updated = await db.workflowDefinition.update({
			where: { id },
			data: { status: "ARCHIVED" },
		});

		return ok({
			id: updated.id,
			status: updated.status,
			updatedAt: updated.updatedAt.toISOString(),
		});
	} catch (e) {
		if (
			e instanceof Error &&
			(e.message === "Unauthorized" || e.message.includes("organization"))
		) {
			return authError(e);
		}
		return err(
			"WORKFLOW_DELETE_FAILED",
			e instanceof Error ? e.message : "Failed to archive workflow",
			400,
		);
	}
}
