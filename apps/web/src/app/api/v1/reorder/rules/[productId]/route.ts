import type { NextRequest } from "next/server";
import { prisma } from "@dropflow/db";
import { UpdateReorderRuleInput } from "@dropflow/types";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ productId: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { productId } = await params;

		const rule = await prisma.reorderRule.findUnique({
			where: { productId },
			include: { product: { select: { name: true, sku: true, stockQty: true, reservedQty: true, salesVelocityDaily: true } } },
		});

		if (!rule || rule.tenantId !== tenantId) {
			return err("RULE_NOT_FOUND", "Reorder rule not found", 404);
		}

		return ok(rule);
	} catch (e) {
		return err("RULE_FETCH_FAILED", e instanceof Error ? e.message : "Failed", 500);
	}
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ productId: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { productId } = await params;
		const body = await req.json();
		const input = UpdateReorderRuleInput.parse(body);

		const existing = await prisma.reorderRule.findUnique({ where: { productId } });
		if (!existing || existing.tenantId !== tenantId) {
			return err("RULE_NOT_FOUND", "Reorder rule not found", 404);
		}

		const rule = await prisma.reorderRule.update({
			where: { productId },
			data: input,
			include: { product: { select: { name: true, sku: true } } },
		});

		return ok(rule);
	} catch (e) {
		return err("RULE_UPDATE_FAILED", e instanceof Error ? e.message : "Failed", 400);
	}
}

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ productId: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { productId } = await params;

		const existing = await prisma.reorderRule.findUnique({ where: { productId } });
		if (!existing || existing.tenantId !== tenantId) {
			return err("RULE_NOT_FOUND", "Reorder rule not found", 404);
		}

		await prisma.reorderRule.delete({ where: { productId } });
		return ok({ deleted: true });
	} catch (e) {
		return err("RULE_DELETE_FAILED", e instanceof Error ? e.message : "Failed", 500);
	}
}
