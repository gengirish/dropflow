import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import type { DashboardKPIs, SkuEconomicsItem } from "@dropflow/types";
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

function addUtcDays(d: Date, days: number): Date {
	const x = new Date(d.getTime());
	x.setUTCDate(x.getUTCDate() + days);
	return x;
}

/** Last 30 calendar days ending today UTC: [start, end] inclusive of end day */
function last30dRange(): { start: Date; end: Date } {
	const end = utcDayStart(new Date());
	const start = addUtcDays(end, -29);
	return { start, end: new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1) };
}

function previous30dRange(): { start: Date; end: Date } {
	const { start: curStart } = last30dRange();
	const endPrev = addUtcDays(curStart, -1);
	const startPrev = addUtcDays(endPrev, -29);
	return {
		start: startPrev,
		end: new Date(endPrev.getTime() + 24 * 60 * 60 * 1000 - 1),
	};
}

async function computeSkuEconomicsItems(
	tenantId: string,
	start: Date,
	end: Date,
): Promise<SkuEconomicsItem[]> {
	const [deliveredOrders, returnedOrders] = await Promise.all([
		prisma.order.findMany({
			where: {
				tenantId,
				status: "DELIVERED",
				createdAt: { gte: start, lte: end },
			},
			include: {
				items: { include: { product: true } },
				invoice: true,
				payments: true,
			},
		}),
		prisma.order.findMany({
			where: {
				tenantId,
				status: "RETURNED",
				createdAt: { gte: start, lte: end },
			},
			include: {
				items: { include: { product: true } },
			},
		}),
	]);

	type Agg = {
		productId: string;
		productName: string;
		sku: string;
		unitsSold: number;
		unitsReturned: number;
		revenuePaise: number;
		cogsPaise: number;
		gstPaise: number;
		shippingPaise: number;
		gatewayFeePaise: number;
		returnCostPaise: number;
	};

	const byProduct = new Map<string, Agg>();

	function ensureAgg(productId: string, name: string, sku: string): Agg {
		let a = byProduct.get(productId);
		if (!a) {
			a = {
				productId,
				productName: name,
				sku,
				unitsSold: 0,
				unitsReturned: 0,
				revenuePaise: 0,
				cogsPaise: 0,
				gstPaise: 0,
				shippingPaise: 0,
				gatewayFeePaise: 0,
				returnCostPaise: 0,
			};
			byProduct.set(productId, a);
		}
		return a;
	}

	for (const order of deliveredOrders) {
		const items = order.items;
		const itemCount = items.length;
		const subtotal = order.subtotalPaise;
		const totalTax = order.invoice?.totalTaxPaise ?? order.taxPaise;
		const gatewayOrder = gatewayFeePaiseForOrder(
			order.totalPaise,
			order.payments,
		);

		for (const line of items) {
			const p = line.product;
			const agg = ensureAgg(p.id, p.name, p.sku);
			const qty = line.quantity;
			agg.unitsSold += qty;
			agg.revenuePaise += line.totalPaise;
			agg.cogsPaise += p.costPricePaise * qty;

			const share =
				subtotal > 0
					? line.totalPaise / subtotal
					: itemCount > 0
						? 1 / itemCount
						: 0;
			agg.gstPaise += Math.round(totalTax * share);
			agg.shippingPaise +=
				itemCount > 0 ? Math.round(order.shippingFeePaise / itemCount) : 0;
			agg.gatewayFeePaise += Math.round(gatewayOrder * share);
		}
	}

	for (const order of returnedOrders) {
		for (const line of order.items) {
			const p = line.product;
			const agg = ensureAgg(p.id, p.name, p.sku);
			const qty = line.quantity;
			agg.unitsReturned += qty;
			agg.returnCostPaise += p.costPricePaise * qty;
		}
	}

	return [...byProduct.values()].map((a) => {
		const netProfitPaise =
			a.revenuePaise -
			a.cogsPaise -
			a.gstPaise -
			a.shippingPaise -
			a.gatewayFeePaise -
			a.returnCostPaise;
		const marginPercent =
			a.revenuePaise > 0 ? (netProfitPaise / a.revenuePaise) * 100 : 0;
		return {
			productId: a.productId,
			productName: a.productName,
			sku: a.sku,
			unitsSold: a.unitsSold,
			unitsReturned: a.unitsReturned,
			revenuePaise: a.revenuePaise,
			cogsPaise: a.cogsPaise,
			gstPaise: a.gstPaise,
			shippingPaise: a.shippingPaise,
			gatewayFeePaise: a.gatewayFeePaise,
			returnCostPaise: a.returnCostPaise,
			netProfitPaise,
			marginPercent,
		};
	});
}

export async function GET(_req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const { start, end } = last30dRange();
		const prev = previous30dRange();

		const [
			deliveredCurrent,
			deliveredPrev,
			allOrdersCurrent,
			returnedCount,
			skuItems,
		] = await Promise.all([
			prisma.order.findMany({
				where: {
					tenantId,
					status: "DELIVERED",
					createdAt: { gte: start, lte: end },
				},
				include: {
					items: { include: { product: true } },
					invoice: true,
					payments: true,
				},
			}),
			prisma.order.findMany({
				where: {
					tenantId,
					status: "DELIVERED",
					createdAt: { gte: prev.start, lte: prev.end },
				},
				select: { totalPaise: true },
			}),
			prisma.order.count({
				where: {
					tenantId,
					createdAt: { gte: start, lte: end },
				},
			}),
			prisma.order.count({
				where: {
					tenantId,
					status: "RETURNED",
					createdAt: { gte: start, lte: end },
				},
			}),
			computeSkuEconomicsItems(tenantId, start, end),
		]);

		let totalRevenuePaise = 0;
		let totalProfitPaise = 0;
		let subtotalSum = 0;

		for (const order of deliveredCurrent) {
			totalRevenuePaise += order.totalPaise;
			subtotalSum += order.subtotalPaise;
			const cogs = order.items.reduce(
				(s, i) => s + i.product.costPricePaise * i.quantity,
				0,
			);
			const gateway = gatewayFeePaiseForOrder(order.totalPaise, order.payments);
			const profit =
				order.subtotalPaise - cogs - order.shippingFeePaise - gateway;
			totalProfitPaise += profit;
		}

		const revenuePrev = deliveredPrev.reduce((s, o) => s + o.totalPaise, 0);

		const totalOrders = allOrdersCurrent;
		const returnRate =
			totalOrders > 0 ? (returnedCount / totalOrders) * 100 : 0;
		const avgOrderValuePaise =
			totalOrders > 0 ? Math.round(totalRevenuePaise / totalOrders) : 0;

		const avgMarginPercent =
			subtotalSum > 0 ? (totalProfitPaise / subtotalSum) * 100 : 0;

		let revenueGrowthPercent = 0;
		if (revenuePrev > 0) {
			revenueGrowthPercent =
				((totalRevenuePaise - revenuePrev) / revenuePrev) * 100;
		} else if (totalRevenuePaise > 0) {
			revenueGrowthPercent = 100;
		}

		const withSales = skuItems.filter(
			(r) => r.unitsSold > 0 || r.revenuePaise > 0,
		);
		const byMargin = [...withSales].sort(
			(a, b) => b.marginPercent - a.marginPercent,
		);
		const topSkus = byMargin.slice(0, 5);
		const worstSkus = [...withSales]
			.sort((a, b) => a.marginPercent - b.marginPercent)
			.slice(0, 5);

		const data: DashboardKPIs = {
			totalRevenuePaise,
			totalProfitPaise,
			avgMarginPercent,
			totalOrders,
			returnRate,
			avgOrderValuePaise,
			revenueGrowthPercent,
			topSkus,
			worstSkus,
		};

		return ok(data);
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
