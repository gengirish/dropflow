import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { AnalyticsDateRange, type RevenueDataPoint } from "@dropflow/types";
import type { NextRequest } from "next/server";

function gatewayFeePaiseForOrder(
	totalPaise: number,
	payments: { amountPaise: number }[],
): number {
	const paid = payments.reduce((s, p) => s + p.amountPaise, 0);
	const base = paid > 0 ? paid : totalPaise;
	return Math.round(base * 0.02);
}

function utcDayStart(d: Date): Date {
	return new Date(
		Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
	);
}

function formatDaily(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function startOfIsoWeekUtc(d: Date): Date {
	const day = d.getUTCDay();
	const diff = (day + 6) % 7;
	return utcDayStart(new Date(d.getTime() - diff * 24 * 60 * 60 * 1000));
}

function formatWeeklyBucket(startMonday: Date): string {
	const y = startMonday.getUTCFullYear();
	const m = String(startMonday.getUTCMonth() + 1).padStart(2, "0");
	const day = String(startMonday.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function formatMonthly(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${m}`;
}

function bucketKey(
	createdAt: Date,
	granularity: "DAILY" | "WEEKLY" | "MONTHLY",
): string {
	const d = new Date(createdAt);
	switch (granularity) {
		case "WEEKLY":
			return formatWeeklyBucket(startOfIsoWeekUtc(d));
		case "MONTHLY":
			return formatMonthly(d);
		default:
			return formatDaily(d);
	}
}

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const sp = req.nextUrl.searchParams;
		let parsed: ReturnType<typeof AnalyticsDateRange.parse>;
		try {
			parsed = AnalyticsDateRange.parse({
				from: sp.get("from") ?? undefined,
				to: sp.get("to") ?? undefined,
				granularity: sp.get("granularity") ?? undefined,
			});
		} catch {
			return err("VALIDATION_ERROR", "Invalid query parameters", 400);
		}

		const toDate = parsed.to ? new Date(parsed.to) : new Date();
		const fromDate = parsed.from
			? new Date(parsed.from)
			: new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

		const start = utcDayStart(fromDate);
		const endDay = utcDayStart(toDate);
		const end = new Date(endDay.getTime() + 24 * 60 * 60 * 1000 - 1);

		const orders = await prisma.order.findMany({
			where: {
				tenantId,
				status: "DELIVERED",
				createdAt: { gte: start, lte: end },
			},
			include: {
				items: { include: { product: true } },
				payments: true,
			},
			orderBy: { createdAt: "asc" },
		});

		type Bucket = {
			revenuePaise: number;
			profitPaise: number;
			orderCount: number;
			cogsPaise: number;
		};

		const buckets = new Map<string, Bucket>();

		for (const order of orders) {
			const key = bucketKey(order.createdAt, parsed.granularity);
			let b = buckets.get(key);
			if (!b) {
				b = { revenuePaise: 0, profitPaise: 0, orderCount: 0, cogsPaise: 0 };
				buckets.set(key, b);
			}
			const cogs = order.items.reduce(
				(s, i) => s + i.product.costPricePaise * i.quantity,
				0,
			);
			const gateway = gatewayFeePaiseForOrder(order.totalPaise, order.payments);
			const profit =
				order.subtotalPaise - cogs - order.shippingFeePaise - gateway;

			b.revenuePaise += order.totalPaise;
			b.profitPaise += profit;
			b.orderCount += 1;
			b.cogsPaise += cogs;
		}

		const keys = [...buckets.keys()].sort();
		const points: RevenueDataPoint[] = [];
		for (const date of keys) {
			const b = buckets.get(date);
			if (!b) continue;
			points.push({
				date,
				revenuePaise: b.revenuePaise,
				profitPaise: b.profitPaise,
				orderCount: b.orderCount,
				cogsPaise: b.cogsPaise,
			});
		}

		return ok(points);
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Unknown error";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("FETCH_FAILED", msg, 500);
	}
}
