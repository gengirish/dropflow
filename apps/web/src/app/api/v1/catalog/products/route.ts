import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import type { Prisma } from "@dropflow/db";
import { Prisma as PrismaRuntime, prisma } from "@dropflow/db";
import { CreateProductInput, ProductFilters } from "@dropflow/types";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const searchParams = req.nextUrl.searchParams;

		const filters = ProductFilters.parse({
			supplierId: searchParams.get("supplierId") ?? undefined,
			isActive: searchParams.get("isActive") ?? undefined,
			isListed: searchParams.get("isListed") ?? undefined,
			lowStock: searchParams.get("lowStock") ?? undefined,
			search: searchParams.get("search") ?? undefined,
			page: searchParams.get("page") ?? 1,
			pageSize: searchParams.get("pageSize") ?? 20,
		});

		const conditions: Prisma.ProductWhereInput[] = [];
		if (filters.supplierId) {
			conditions.push({ supplierId: filters.supplierId });
		}
		if (filters.isActive !== undefined) {
			conditions.push({ isActive: filters.isActive });
		}
		if (filters.isListed !== undefined) {
			conditions.push({ isListed: filters.isListed });
		}
		if (filters.search) {
			conditions.push({
				OR: [
					{ name: { contains: filters.search, mode: "insensitive" } },
					{ sku: { contains: filters.search, mode: "insensitive" } },
				],
			});
		}
		if (filters.lowStock) {
			conditions.push({
				stockQty: { lte: prisma.product.fields.lowStockThreshold },
			});
		}

		const firstCondition = conditions[0];
		const where: Prisma.ProductWhereInput =
			conditions.length === 0
				? {}
				: conditions.length === 1 && firstCondition !== undefined
					? firstCondition
					: { AND: conditions };

		const [items, total] = await Promise.all([
			db.product.findMany({
				where,
				include: { supplier: { select: { id: true, name: true } } },
				orderBy: { createdAt: "desc" },
				skip: (filters.page - 1) * filters.pageSize,
				take: filters.pageSize,
			}),
			db.product.count({ where: { ...where, tenantId } }),
		]);

		return paginated(items, total, filters.page, filters.pageSize);
	} catch (e) {
		return err(
			"PRODUCTS_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to fetch products",
			500,
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const db = getTenantPrisma(tenantId);
		const body = await req.json();
		const input = CreateProductInput.parse(body);

		const marginPercent =
			input.sellingPricePaise > 0
				? ((input.sellingPricePaise - input.costPricePaise) /
						input.sellingPricePaise) *
					100
				: 0;

		const product = await db.product.create({
			data: {
				...input,
				tenantId,
				marginPercent,
				images: input.images ?? [],
			},
			include: { supplier: { select: { id: true, name: true } } },
		});

		return ok(product, 201);
	} catch (e) {
		if (
			e instanceof PrismaRuntime.PrismaClientKnownRequestError &&
			e.code === "P2002"
		) {
			return err(
				"DUPLICATE_SKU",
				"A product with this SKU already exists",
				409,
			);
		}
		return err(
			"PRODUCT_CREATE_FAILED",
			e instanceof Error ? e.message : "Failed to create product",
			400,
		);
	}
}
