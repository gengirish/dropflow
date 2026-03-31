import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { SkuEconomicsFilters, type SkuEconomicsItem } from "@dropflow/types";
import type { NextRequest } from "next/server";

function utcPeriodBounds(period: string): { start: Date; end: Date } {
	const parts = period.split("-").map(Number);
	const y = parts[0];
	const m = parts[1];
	if (!y || !m || m < 1 || m > 12) {
		throw new Error("Invalid period; expected YYYY-MM");
	}
	const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
	const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
	return { start, end };
}

function defaultPeriodYm(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${mo}`;
}

function gatewayFeePaiseForOrder(
	totalPaise: number,
	payments: { amountPaise: number }[],
): number {
	const paid = payments.reduce((s, p) => s + p.amountPaise, 0);
	const base = paid > 0 ? paid : totalPaise;
	return Math.round(base * 0.02);
}

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const sp = req.nextUrl.searchParams;
		let filters: ReturnType<typeof SkuEconomicsFilters.parse>;
		try {
			filters = SkuEconomicsFilters.parse({
				period: sp.get("period") ?? undefined,
				sortBy: sp.get("sortBy") ?? undefined,
				sortOrder: sp.get("sortOrder") ?? undefined,
				limit: sp.get("limit") ?? undefined,
			});
		} catch {
			return err("VALIDATION_ERROR", "Invalid query parameters", 400);
		}

		const period = filters.period ?? defaultPeriodYm();
		const { start, end } = utcPeriodBounds(period);

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

		const rows: SkuEconomicsItem[] = [...byProduct.values()].map((a) => {
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

		const dir = filters.sortOrder === "asc" ? 1 : -1;
		rows.sort((x, y) => {
			let vx: number;
			let vy: number;
			switch (filters.sortBy) {
				case "margin":
					vx = x.marginPercent;
					vy = y.marginPercent;
					break;
				case "units":
					vx = x.unitsSold;
					vy = y.unitsSold;
					break;
				case "profit":
					vx = x.netProfitPaise;
					vy = y.netProfitPaise;
					break;
				default:
					vx = x.revenuePaise;
					vy = y.revenuePaise;
					break;
			}
			if (vx === vy) return x.sku.localeCompare(y.sku) * dir;
			return vx < vy ? -dir : dir;
		});

		return ok(rows.slice(0, filters.limit));
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
