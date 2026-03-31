import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { reactFlowToDagNodes } from "@/lib/workflow-dag";
import { Prisma } from "@dropflow/db";
import type { Edge, Node } from "@xyflow/react";
import type { NextRequest } from "next/server";
import { z } from "zod";

const CreateBody = z.object({
	name: z.string().min(1).max(200),
	trigger: z.string().min(1).max(200),
	nodes: z.array(z.any()),
	edges: z.array(z.any()),
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

export async function GET() {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);

		const items = await db.workflowDefinition.findMany({
			include: {
				_count: { select: { runs: true } },
			},
			orderBy: [{ updatedAt: "desc" }],
		});

		const data = items.map((w) => ({
			id: w.id,
			name: w.name,
			trigger: w.trigger,
			version: w.version,
			status: w.status,
			createdAt: w.createdAt.toISOString(),
			updatedAt: w.updatedAt.toISOString(),
			runsCount: w._count.runs,
		}));

		return ok(data);
	} catch (e) {
		if (
			e instanceof Error &&
			(e.message === "Unauthorized" || e.message.includes("organization"))
		) {
			return authError(e);
		}
		return err(
			"WORKFLOWS_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to list workflows",
			500,
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const json = await req.json();
		const body = CreateBody.parse(json);

		const converted = reactFlowToDagNodes(
			body.nodes as Node[],
			body.edges as Edge[],
		);
		if (!converted.ok) {
			return err(converted.error.code, converted.error.message, 422);
		}

		const latest = await db.workflowDefinition.findFirst({
			where: { name: body.name },
			orderBy: { version: "desc" },
		});
		const version = (latest?.version ?? 0) + 1;

		const dagJson = {
			nodes: converted.dag,
		} as unknown as Prisma.InputJsonValue;

		const created = await db.workflowDefinition.create({
			data: {
				tenantId,
				name: body.name,
				trigger: body.trigger,
				version,
				dagJson,
				status: "ACTIVE",
			},
		});

		return ok(
			{
				id: created.id,
				name: created.name,
				trigger: created.trigger,
				version: created.version,
				status: created.status,
				dagJson: created.dagJson,
				configJson: created.configJson,
				createdAt: created.createdAt.toISOString(),
				updatedAt: created.updatedAt.toISOString(),
				runsCount: 0,
			},
			201,
		);
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
		if (
			e instanceof Prisma.PrismaClientKnownRequestError &&
			e.code === "P2002"
		) {
			return err(
				"DUPLICATE_VERSION",
				"A workflow version conflict occurred",
				409,
			);
		}
		return err(
			"WORKFLOW_CREATE_FAILED",
			e instanceof Error ? e.message : "Failed to create workflow",
			400,
		);
	}
}
