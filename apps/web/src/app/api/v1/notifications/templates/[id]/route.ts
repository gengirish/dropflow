import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { UpdateNotificationTemplateInput } from "@dropflow/types";
import type { NextRequest } from "next/server";

function extractVariableKeys(templateBody: string): string[] {
	const keys = new Set<string>();
	for (const m of templateBody.matchAll(/\{\{(\w+)\}\}/g)) {
		const key = m[1];
		if (key) keys.add(key);
	}
	return [...keys];
}

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await params;

		const template = await prisma.notificationTemplate.findFirst({
			where: { id, tenantId },
		});

		if (!template) {
			return err("NOTIFICATION_TEMPLATE_NOT_FOUND", "Template not found", 404);
		}

		return ok(template);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("NOTIFICATION_TEMPLATE_FETCH_FAILED", msg, 500);
	}
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await params;
		const body = await req.json();
		const input = UpdateNotificationTemplateInput.parse(body);

		const existing = await prisma.notificationTemplate.findFirst({
			where: { id, tenantId },
		});

		if (!existing) {
			return err("NOTIFICATION_TEMPLATE_NOT_FOUND", "Template not found", 404);
		}

		const nextBody = input.templateBody ?? existing.templateBody;
		const variables =
			input.variables !== undefined
				? input.variables.length > 0
					? input.variables
					: extractVariableKeys(nextBody)
				: input.templateBody !== undefined
					? extractVariableKeys(nextBody)
					: undefined;

		const updated = await prisma.notificationTemplate.update({
			where: { id },
			data: {
				...(input.channel !== undefined ? { channel: input.channel } : {}),
				...(input.triggerEvent !== undefined
					? { triggerEvent: input.triggerEvent }
					: {}),
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.templateId !== undefined
					? { templateId: input.templateId }
					: {}),
				...(input.templateBody !== undefined
					? { templateBody: input.templateBody }
					: {}),
				...(variables !== undefined ? { variables } : {}),
				...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
			},
		});

		return ok(updated);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		if (msg.includes("Unique constraint")) {
			return err(
				"NOTIFICATION_TEMPLATE_DUPLICATE",
				"A template already exists for this channel and trigger",
				409,
			);
		}
		return err("NOTIFICATION_TEMPLATE_UPDATE_FAILED", msg, 400);
	}
}

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await params;

		const result = await prisma.notificationTemplate.deleteMany({
			where: { id, tenantId },
		});

		if (result.count === 0) {
			return err("NOTIFICATION_TEMPLATE_NOT_FOUND", "Template not found", 404);
		}

		return ok({ deleted: true });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("NOTIFICATION_TEMPLATE_DELETE_FAILED", msg, 500);
	}
}
