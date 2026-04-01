import type { NextRequest } from "next/server";
import { prisma, type Prisma } from "@dropflow/db";
import { CreateOrderInput, OrderFilters } from "@dropflow/types";
import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

function generateOrderNumber(): string {
	const now = new Date();
	const yy = String(now.getFullYear()).slice(2);
	const mm = String(now.getMonth() + 1).padStart(2, "0");
	const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
	return `ORD-${yy}${mm}-${rand}`;
}

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const sp = req.nextUrl.searchParams;

		const filters = OrderFilters.parse({
			status: sp.get("status") ?? undefined,
			supplierId: sp.get("supplierId") ?? undefined,
			dateFrom: sp.get("dateFrom") ?? undefined,
			dateTo: sp.get("dateTo") ?? undefined,
			search: sp.get("search") ?? undefined,
			page: sp.get("page") ?? 1,
			pageSize: sp.get("pageSize") ?? 20,
		});

		const where: Prisma.OrderWhereInput = { tenantId };
		if (filters.status) {
			where.status = filters.status as Prisma.OrderWhereInput["status"];
		}
		if (filters.supplierId) {
			where.items = {
				some: { product: { supplierId: filters.supplierId } },
			};
		}
		if (filters.search) {
			where.OR = [
				{ orderNumber: { contains: filters.search, mode: "insensitive" } },
				{ buyerName: { contains: filters.search, mode: "insensitive" } },
				{ buyerEmail: { contains: filters.search, mode: "insensitive" } },
			];
		}
		if (filters.dateFrom || filters.dateTo) {
			const createdAt: Prisma.DateTimeFilter = {};
			if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
			if (filters.dateTo) createdAt.lte = new Date(filters.dateTo);
			where.createdAt = createdAt;
		}

		const [items, total] = await Promise.all([
			prisma.order.findMany({
				where,
				include: {
					items: { include: { product: { select: { name: true, sku: true } } } },
					_count: { select: { items: true } },
				},
				orderBy: { createdAt: "desc" },
				skip: (filters.page - 1) * filters.pageSize,
				take: filters.pageSize,
			}),
			prisma.order.count({ where }),
		]);

		return paginated(items, total, filters.page, filters.pageSize);
	} catch (e) {
		return err("ORDERS_FETCH_FAILED", e instanceof Error ? e.message : "Failed", 500);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const body = await req.json();
		const input = CreateOrderInput.parse(body);

		const products = await prisma.product.findMany({
			where: {
				tenantId,
				id: { in: input.items.map((i) => i.productId) },
			},
		});

		const productMap = new Map(products.map((p) => [p.id, p]));
		let subtotalPaise = 0;
		let taxPaise = 0;

		const orderItems = input.items.map((item) => {
			const product = productMap.get(item.productId);
			if (!product) throw new Error(`Product not found: ${item.productId}`);
			if (product.stockQty - product.reservedQty < item.quantity) {
				throw new Error(`Insufficient stock for ${product.name}`);
			}

			const unitPrice = product.sellingPricePaise;
			const total = unitPrice * item.quantity;
			const itemTax = Math.round((total * product.gstRatePercent) / 100);
			subtotalPaise += total;
			taxPaise += itemTax;

			return {
				tenantId,
				productId: item.productId,
				variantId: item.variantId,
				quantity: item.quantity,
				unitPricePaise: unitPrice,
				totalPaise: total,
				hsnCode: product.hsnCode,
			};
		});

		const totalPaise = subtotalPaise + taxPaise;

		const order = await prisma.order.create({
			data: {
				tenantId,
				orderNumber: generateOrderNumber(),
				buyerName: input.buyerName,
				buyerEmail: input.buyerEmail,
				buyerPhone: input.buyerPhone,
				shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
				billingAddress: input.billingAddress as Prisma.InputJsonValue,
				status: "PENDING",
				paymentMethod: input.paymentMethod,
				currency: input.currency,
				channelId: input.channelId,
				subtotalPaise,
				taxPaise,
				totalPaise,
				notes: input.notes,
				items: { create: orderItems },
				statusHistory: {
					create: {
						tenantId,
						status: "PENDING",
						note: "Order created",
					},
				},
			},
			include: {
				items: { include: { product: { select: { name: true, sku: true } } } },
			},
		});

		const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
		const workerSecret = process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

		const enqueueJob = (queue: string, payload: Record<string, unknown>, jobName?: string) =>
			fetch(`${workerUrl}/internal/enqueue`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "x-worker-secret": workerSecret },
				body: JSON.stringify({ queue, jobName, payload }),
			}).catch((e) => console.error(`Failed to enqueue ${queue}:`, e));

		await Promise.allSettled([
			enqueueJob("order-queue", { tenantId, orderId: order.id }),
			enqueueJob("rto-queue", { tenantId, orderId: order.id }, "score-order"),
			enqueueJob("analytics-queue", { tenantId, orderId: order.id }, "compute-order-margins"),
		]);

		return ok(order, 201);
	} catch (e) {
		return err("ORDER_CREATE_FAILED", e instanceof Error ? e.message : "Failed", 400);
	}
}
