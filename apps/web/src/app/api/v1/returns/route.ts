import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { RETURNS } from "@dropflow/config";
import { type Prisma, prisma } from "@dropflow/db";
import { CreateReturnInput, ReturnFilters } from "@dropflow/types";
import type { NextRequest } from "next/server";
import { z } from "zod";

function generateReturnNumber(): string {
	const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
	return `${RETURNS.PREFIX}${Date.now()}${suffix}`;
}

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const sp = req.nextUrl.searchParams;

		const filters = ReturnFilters.parse({
			status: sp.get("status") ?? undefined,
			reason: sp.get("reason") ?? undefined,
			orderId: sp.get("orderId") ?? undefined,
			dateFrom: sp.get("dateFrom") ?? undefined,
			dateTo: sp.get("dateTo") ?? undefined,
			page: sp.get("page") ?? 1,
			pageSize: sp.get("pageSize") ?? 20,
		});

		const where: Prisma.ReturnRequestWhereInput = { tenantId };

		if (filters.status) {
			const parsed = z
				.enum([
					"REQUESTED",
					"APPROVED",
					"PICKUP_SCHEDULED",
					"PICKED_UP",
					"RECEIVED",
					"QC_PASSED",
					"QC_FAILED",
					"RESTOCKED",
					"DISPOSED",
					"REFUND_INITIATED",
					"REFUND_COMPLETED",
					"REJECTED",
				])
				.safeParse(filters.status);
			if (parsed.success) {
				where.status = parsed.data;
			}
		}
		if (filters.reason) {
			const parsed = z
				.enum([
					"DEFECTIVE",
					"WRONG_ITEM",
					"SIZE_ISSUE",
					"DAMAGED_IN_TRANSIT",
					"NOT_AS_DESCRIBED",
					"CHANGED_MIND",
					"OTHER",
				])
				.safeParse(filters.reason);
			if (parsed.success) {
				where.reason = parsed.data;
			}
		}
		if (filters.orderId) {
			where.orderId = filters.orderId;
		}
		if (filters.dateFrom || filters.dateTo) {
			const createdAt: Prisma.DateTimeFilter = {};
			if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
			if (filters.dateTo) createdAt.lte = new Date(filters.dateTo);
			where.createdAt = createdAt;
		}

		const [rows, total] = await Promise.all([
			prisma.returnRequest.findMany({
				where,
				include: {
					order: { select: { id: true, orderNumber: true, status: true } },
					items: { select: { id: true } },
					refund: { select: { id: true, status: true, amountPaise: true } },
				},
				orderBy: { createdAt: "desc" },
				skip: (filters.page - 1) * filters.pageSize,
				take: filters.pageSize,
			}),
			prisma.returnRequest.count({ where }),
		]);

		const items = rows.map((r) => ({
			...r,
			itemCount: r.items.length,
		}));

		return paginated(items, total, filters.page, filters.pageSize);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		if (e instanceof z.ZodError) {
			return err("VALIDATION_ERROR", e.message, 400);
		}
		return err("RETURNS_LIST_FAILED", msg, 500);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const body = CreateReturnInput.parse(await req.json());

		const order = await prisma.order.findFirst({
			where: { id: body.orderId, tenantId },
			include: { items: true },
		});

		if (!order) {
			return err("ORDER_NOT_FOUND", "Order not found", 404);
		}

		if (order.status === "CANCELLED" || order.status === "REFUNDED") {
			return err(
				"ORDER_NOT_ELIGIBLE",
				"Order cannot be returned in its current state",
				400,
			);
		}

		const orderItemIds = new Set(order.items.map((i) => i.id));
		for (const line of body.items) {
			if (!orderItemIds.has(line.orderItemId)) {
				return err(
					"INVALID_ORDER_ITEM",
					`Order item ${line.orderItemId} is not on this order`,
					400,
				);
			}
			const oi = order.items.find((i) => i.id === line.orderItemId);
			if (!oi) {
				return err(
					"INVALID_ORDER_ITEM",
					`Order item ${line.orderItemId} is not on this order`,
					400,
				);
			}
			if (line.quantity > oi.quantity) {
				return err(
					"INVALID_QUANTITY",
					`Quantity exceeds ordered for item ${line.orderItemId}`,
					400,
				);
			}
			if (line.productId !== oi.productId) {
				return err(
					"PRODUCT_MISMATCH",
					"productId does not match order line",
					400,
				);
			}
		}

		const returnNumber = generateReturnNumber();

		const created = await prisma.$transaction(async (tx) => {
			const rr = await tx.returnRequest.create({
				data: {
					tenantId,
					orderId: body.orderId,
					returnNumber,
					status: "REQUESTED",
					reason: body.reason,
					customerNotes: body.customerNotes,
					items: {
						create: body.items.map((line) => ({
							tenantId,
							orderItemId: line.orderItemId,
							productId: line.productId,
							quantity: line.quantity,
							reason: line.reason,
						})),
					},
				},
				include: {
					items: true,
					order: { select: { orderNumber: true } },
					refund: true,
				},
			});

			await tx.order.update({
				where: { id: body.orderId },
				data: { status: "RETURN_REQUESTED" },
			});

			return rr;
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
		if (e instanceof z.ZodError) {
			return err("VALIDATION_ERROR", e.message, 400);
		}
		return err("RETURN_CREATE_FAILED", msg, 500);
	}
}
