import type { NextRequest } from "next/server";
import { prisma, type Prisma } from "@dropflow/db";
import { CreateIncidentInput } from "@dropflow/types";
import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const sp = req.nextUrl.searchParams;
		const page = Number(sp.get("page") ?? 1);
		const pageSize = Number(sp.get("pageSize") ?? 20);
		const supplierId = sp.get("supplierId") ?? undefined;
		const type = sp.get("type") ?? undefined;

		const where: Prisma.SupplierIncidentWhereInput = { tenantId };
		if (supplierId) where.supplierId = supplierId;
		if (type) where.type = type;

		const [items, total] = await Promise.all([
			prisma.supplierIncident.findMany({
				where,
				include: { supplier: { select: { name: true } } },
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
			prisma.supplierIncident.count({ where }),
		]);

		return paginated(items, total, page, pageSize);
	} catch (e) {
		return err("INCIDENTS_FETCH_FAILED", e instanceof Error ? e.message : "Failed", 500);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const body = await req.json();
		const input = CreateIncidentInput.parse(body);

		const supplier = await prisma.supplier.findFirst({
			where: { id: input.supplierId, tenantId },
		});
		if (!supplier) return err("SUPPLIER_NOT_FOUND", "Supplier not found", 404);

		const incident = await prisma.supplierIncident.create({
			data: {
				tenantId,
				supplierId: input.supplierId,
				type: input.type,
				severity: input.severity,
				description: input.description,
				poId: input.poId,
				orderId: input.orderId,
			},
			include: { supplier: { select: { name: true } } },
		});

		return ok(incident, 201);
	} catch (e) {
		return err("INCIDENT_CREATE_FAILED", e instanceof Error ? e.message : "Failed", 400);
	}
}
