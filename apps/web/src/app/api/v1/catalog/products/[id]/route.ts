import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { UpdateProductInput } from "@dropflow/types";
import type { NextRequest } from "next/server";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const { id } = await params;

		const product = await db.product.findFirst({
			where: { id },
			include: {
				supplier: { select: { id: true, name: true } },
				variants: true,
			},
		});

		if (!product) {
			return err("NOT_FOUND", "Product not found", 404);
		}

		return ok(product);
	} catch (e) {
		return err(
			"PRODUCT_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to fetch product",
			500,
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
		const body = await req.json();
		const input = UpdateProductInput.parse(body);

		const existing = await db.product.findFirst({ where: { id } });
		if (!existing) {
			return err("NOT_FOUND", "Product not found", 404);
		}

		const costPrice = input.costPricePaise ?? existing.costPricePaise;
		const sellPrice = input.sellingPricePaise ?? existing.sellingPricePaise;
		const marginPercent =
			sellPrice > 0 ? ((sellPrice - costPrice) / sellPrice) * 100 : 0;

		const product = await db.product.update({
			where: { id },
			data: { ...input, marginPercent },
			include: { supplier: { select: { id: true, name: true } } },
		});

		return ok(product);
	} catch (e) {
		return err(
			"PRODUCT_UPDATE_FAILED",
			e instanceof Error ? e.message : "Failed to update product",
			400,
		);
	}
}
