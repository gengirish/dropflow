import type { NextRequest } from "next/server";
import { prisma } from "@dropflow/db";
import type { MarginDashboardKPIs } from "@dropflow/types";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

export async function GET(_req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();

		const breakdowns = await prisma.orderMarginBreakdown.findMany({
			where: { tenantId },
			include: {
				order: {
					select: {
						items: {
						select: {
							product: { select: { id: true, name: true, sku: true } },
							unitPricePaise: true,
							quantity: true,
						},
						},
					},
				},
			},
		});

		const totalRevenuePaise = breakdowns.reduce(
			(s, b) => s + b.sellingPricePaise,
			0,
		);
		const totalCostPaise = breakdowns.reduce(
			(s, b) =>
				s +
				b.costPricePaise +
				b.gstPaise +
				b.shippingCostPaise +
				b.gatewayFeePaise +
				b.packagingCostPaise +
				b.returnReservePaise +
				b.discountPaise +
				b.otherCostsPaise,
			0,
		);
		const totalProfitPaise = breakdowns.reduce(
			(s, b) => s + b.netMarginPaise,
			0,
		);
		const avgMarginPercent =
			breakdowns.length > 0
				? breakdowns.reduce((s, b) => s + b.marginPercent, 0) /
					breakdowns.length
				: 0;
		const avgOrderMarginPaise =
			breakdowns.length > 0
				? Math.round(totalProfitPaise / breakdowns.length)
				: 0;
		const totalShippingPaise = breakdowns.reduce(
			(s, b) => s + b.shippingCostPaise,
			0,
		);
		const totalGatewayFeesPaise = breakdowns.reduce(
			(s, b) => s + b.gatewayFeePaise,
			0,
		);
		const totalGstPaise = breakdowns.reduce((s, b) => s + b.gstPaise, 0);
		const totalReturnCostPaise = breakdowns.reduce(
			(s, b) => s + b.returnReservePaise,
			0,
		);

		const productMap = new Map<
			string,
			{ name: string; sku: string; revenue: number; profit: number }
		>();
		for (const b of breakdowns) {
			for (const item of b.order.items) {
				const key = item.product.id;
				const existing = productMap.get(key) ?? {
					name: item.product.name,
					sku: item.product.sku,
					revenue: 0,
					profit: 0,
				};
				existing.revenue += item.unitPricePaise * item.quantity;
				existing.profit += b.netMarginPaise;
				productMap.set(key, existing);
			}
		}

		const productList = Array.from(productMap.entries())
			.map(([productId, p]) => ({
				productId,
				name: p.name,
				sku: p.sku,
				marginPercent: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0,
				netProfitPaise: p.profit,
			}))
			.sort((a, b) => b.marginPercent - a.marginPercent);

		const data: MarginDashboardKPIs = {
			avgMarginPercent: Math.round(avgMarginPercent * 100) / 100,
			totalRevenuePaise,
			totalCostPaise,
			totalProfitPaise,
			avgOrderMarginPaise,
			totalShippingPaise,
			totalGatewayFeesPaise,
			totalGstPaise,
			totalReturnCostPaise,
			topMarginProducts: productList.slice(0, 5),
			worstMarginProducts: productList.slice(-5).reverse(),
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
		return err("MARGIN_ANALYTICS_FAILED", msg, 500);
	}
}
