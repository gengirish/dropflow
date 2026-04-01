import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { type Prisma, prisma } from "@dropflow/db";
import { CreateNotificationTemplateInput } from "@dropflow/types";
import type { NextRequest } from "next/server";
import { z } from "zod";

const ListQuery = z.object({
	channel: z.enum(["WHATSAPP", "EMAIL", "SMS", "IN_APP"]).optional(),
	triggerEvent: z.string().optional(),
});

function extractVariableKeys(templateBody: string): string[] {
	const keys = new Set<string>();
	for (const m of templateBody.matchAll(/\{\{(\w+)\}\}/g)) {
		const key = m[1];
		if (key) keys.add(key);
	}
	return [...keys];
}

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const sp = req.nextUrl.searchParams;
		const filters = ListQuery.parse({
			channel: sp.get("channel") ?? undefined,
			triggerEvent: sp.get("triggerEvent") ?? undefined,
		});

		const where: Prisma.NotificationTemplateWhereInput = { tenantId };
		if (filters.channel) where.channel = filters.channel;
		if (filters.triggerEvent) where.triggerEvent = filters.triggerEvent;

		const templates = await prisma.notificationTemplate.findMany({
			where,
			orderBy: [{ channel: "asc" }, { triggerEvent: "asc" }, { name: "asc" }],
		});

		return ok(templates);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("NOTIFICATION_TEMPLATES_FETCH_FAILED", msg, 500);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const body = await req.json();
		const input = CreateNotificationTemplateInput.parse(body);

		const variables =
			input.variables.length > 0
				? input.variables
				: extractVariableKeys(input.templateBody);

		const created = await prisma.notificationTemplate.create({
			data: {
				tenantId,
				channel: input.channel,
				triggerEvent: input.triggerEvent,
				name: input.name,
				templateId: input.templateId ?? null,
				templateBody: input.templateBody,
				variables,
				isActive: input.isActive,
			},
		});

		return ok(created, 201);
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
		return err("NOTIFICATION_TEMPLATE_CREATE_FAILED", msg, 400);
	}
}
