import type { MarginWaterfallItem, OrderMarginResponse } from "@dropflow/types";
import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import type { NextRequest } from "next/server";

function buildWaterfall(
	sellingPricePaise: number,
	b: {
		costPricePaise: number;
		gstPaise: number;
		shippingCostPaise: number;
		gatewayFeePaise: number;
		packagingCostPaise: number;
		returnReservePaise: number;
		discountPaise: number;
		otherCostsPaise: number;
		netMarginPaise: number;
		marginPercent: number;
	},
): MarginWaterfallItem[] {
	const sp = sellingPricePaise;
	const pct = (amount: number) => (sp > 0 ? (Math.abs(amount) / sp) * 100 : 0);

	return [
		{
			label: "Selling price",
			amountPaise: sp,
			percent: sp > 0 ? 100 : 0,
			type: "revenue",
		},
		{
			label: "COGS",
			amountPaise: -b.costPricePaise,
			percent: pct(b.costPricePaise),
			type: "cost",
		},
		{
			label: "GST",
			amountPaise: -b.gstPaise,
			percent: pct(b.gstPaise),
			type: "cost",
		},
		{
			label: "Shipping",
			amountPaise: -b.shippingCostPaise,
			percent: pct(b.shippingCostPaise),
			type: "cost",
		},
		{
			label: "Gateway fees",
			amountPaise: -b.gatewayFeePaise,
			percent: pct(b.gatewayFeePaise),
			type: "cost",
		},
		{
			label: "Packaging",
			amountPaise: -b.packagingCostPaise,
			percent: pct(b.packagingCostPaise),
			type: "cost",
		},
		{
			label: "Return reserve",
			amountPaise: -b.returnReservePaise,
			percent: pct(b.returnReservePaise),
			type: "cost",
		},
		{
			label: "Discount",
			amountPaise: -b.discountPaise,
			percent: pct(b.discountPaise),
			type: "cost",
		},
		...(b.otherCostsPaise > 0
			? [
					{
						label: "Other costs",
						amountPaise: -b.otherCostsPaise,
						percent: pct(b.otherCostsPaise),
						type: "cost" as const,
					},
				]
			: []),
		{
			label: "Net margin",
			amountPaise: b.netMarginPaise,
			percent: b.marginPercent,
			type: "net",
		},
	];
}

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ orderId: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { orderId } = await params;

		const row = await prisma.orderMarginBreakdown.findFirst({
			where: { orderId, tenantId },
			include: {
				order: { select: { orderNumber: true } },
			},
		});

		if (!row) {
			return err("NOT_FOUND", "Margin breakdown not found for this order", 404);
		}

		const data: OrderMarginResponse = {
			orderId: row.orderId,
			orderNumber: row.order.orderNumber,
			sellingPricePaise: row.sellingPricePaise,
			costPricePaise: row.costPricePaise,
			gstPaise: row.gstPaise,
			shippingCostPaise: row.shippingCostPaise,
			gatewayFeePaise: row.gatewayFeePaise,
			packagingCostPaise: row.packagingCostPaise,
			returnReservePaise: row.returnReservePaise,
			discountPaise: row.discountPaise,
			otherCostsPaise: row.otherCostsPaise,
			netMarginPaise: row.netMarginPaise,
			marginPercent: row.marginPercent,
			waterfall: buildWaterfall(row.sellingPricePaise, row),
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
