import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { CreateSupplierInput } from "@dropflow/types";
import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);

		const suppliers = await db.supplier.findMany({
			orderBy: { name: "asc" },
			include: { _count: { select: { products: true } } },
		});

		return ok(suppliers);
	} catch (e) {
		return err(
			"SUPPLIERS_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to fetch suppliers",
			500,
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const body = await req.json();
		const input = CreateSupplierInput.parse(body);

		const supplier = await db.supplier.create({
			data: { ...input, tenantId },
		});

		return ok(supplier, 201);
	} catch (e) {
		return err(
			"SUPPLIER_CREATE_FAILED",
			e instanceof Error ? e.message : "Failed to create supplier",
			400,
		);
	}
}
