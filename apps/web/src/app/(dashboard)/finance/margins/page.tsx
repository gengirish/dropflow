"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
	ArrowLeft,
	CreditCard,
	Percent,
	TrendingDown,
	TrendingUp,
	Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { MarginDashboardKPIs } from "@dropflow/types";

type AggregateWaterfall = {
	sellingPricePaise: number;
	costPricePaise: number;
	gstPaise: number;
	shippingCostPaise: number;
	gatewayFeePaise: number;
	packagingCostPaise: number;
	returnReservePaise: number;
	discountPaise: number;
	otherCostsPaise: number;
	netMarginPaise: number;
};

type MarginsApiData = MarginDashboardKPIs & {
	aggregateWaterfall: AggregateWaterfall;
};

function formatPaise(paise: number): string {
	const rupees = paise / 100;
	return `₹${rupees.toLocaleString("en-IN", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function formatPercent(n: number): string {
	return `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

type WaterfallRow = {
	key: string;
	label: string;
	amountPaise: number;
	kind: "revenue" | "cost" | "net";
};

function buildAggregateRows(w: AggregateWaterfall): WaterfallRow[] {
	const rows: WaterfallRow[] = [
		{
			key: "selling",
			label: "Selling price",
			amountPaise: w.sellingPricePaise,
			kind: "revenue",
		},
		{
			key: "cogs",
			label: "COGS",
			amountPaise: -w.costPricePaise,
			kind: "cost",
		},
		{
			key: "gst",
			label: "GST",
			amountPaise: -w.gstPaise,
			kind: "cost",
		},
		{
			key: "ship",
			label: "Shipping",
			amountPaise: -w.shippingCostPaise,
			kind: "cost",
		},
		{
			key: "gateway",
			label: "Gateway fees",
			amountPaise: -w.gatewayFeePaise,
			kind: "cost",
		},
		{
			key: "pack",
			label: "Packaging",
			amountPaise: -w.packagingCostPaise,
			kind: "cost",
		},
		{
			key: "return",
			label: "Return reserve",
			amountPaise: -w.returnReservePaise,
			kind: "cost",
		},
		{
			key: "disc",
			label: "Discount",
			amountPaise: -w.discountPaise,
			kind: "cost",
		},
	];
	if (w.otherCostsPaise > 0) {
		rows.push({
			key: "other",
			label: "Other costs",
			amountPaise: -w.otherCostsPaise,
			kind: "cost",
		});
	}
	rows.push({
		key: "net",
		label: "Net margin",
		amountPaise: w.netMarginPaise,
		kind: "net",
	});
	return rows;
}

function barColor(kind: WaterfallRow["kind"]): string {
	switch (kind) {
		case "revenue":
			return "bg-emerald-500";
		case "cost":
			return "bg-red-500";
		default:
			return "bg-sky-600";
	}
}

function MarginWaterfallChart({ waterfall }: { waterfall: AggregateWaterfall }) {
	const rows = buildAggregateRows(waterfall);
	const denom = Math.max(waterfall.sellingPricePaise, 1);

	return (
		<div className="space-y-3">
			<p className="text-sm text-muted-foreground">
				Aggregate margin walk — bar width is relative to total selling price in
				range.
			</p>
			<div className="space-y-2">
				{rows.map((row) => {
					const mag = Math.abs(row.amountPaise);
					const pct = Math.min(100, (mag / denom) * 100);
					return (
						<div
							key={row.key}
							className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,10rem)_1fr_auto] sm:items-center"
						>
							<span className="text-sm font-medium text-foreground">
								{row.label}
							</span>
							<div className="h-6 w-full overflow-hidden rounded-md bg-muted">
								<div
									className={`h-full min-w-[2px] rounded-md transition-all ${barColor(row.kind)}`}
									style={{ width: `${Math.max(pct, row.kind === "net" && mag > 0 ? 2 : 0)}%` }}
									title={`${row.label}: ${formatPaise(row.amountPaise)}`}
								/>
							</div>
							<span
								className={`text-right text-sm tabular-nums sm:pl-2 ${
									row.amountPaise < 0 ? "text-red-600 dark:text-red-400" : ""
								} ${row.kind === "net" ? "font-semibold text-sky-700 dark:text-sky-400" : ""}`}
							>
								{row.amountPaise < 0 ? "−" : ""}
								{formatPaise(Math.abs(row.amountPaise))}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export default function MarginsPage() {
	const [data, setData] = useState<MarginsApiData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		const res = await fetch("/api/v1/analytics/margins");
		const json = await res.json();
		if (!json.success) {
			setError(json.error?.message ?? "Failed to load margins");
			setData(null);
		} else {
			setData(json.data as MarginsApiData);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	if (loading && !data) {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-4">
					<Link
						href="/finance"
						className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" aria-hidden />
						Finance
					</Link>
				</div>
				<h1 className="text-2xl font-bold">Margin waterfall</h1>
				<p className="text-muted-foreground">Loading…</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="space-y-6">
				<Link
					href="/finance"
					className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden />
					Finance
				</Link>
				<h1 className="text-2xl font-bold">Margin waterfall</h1>
				<p className="text-destructive">{error ?? "No data"}</p>
			</div>
		);
	}

	const { aggregateWaterfall, ...kpis } = data;

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<Link
						href="/finance"
						className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" aria-hidden />
						Finance
					</Link>
					<h1 className="text-2xl font-bold">Margin waterfall</h1>
					<p className="text-sm text-muted-foreground">
						Real-time margin analytics from computed order breakdowns
					</p>
				</div>
				<Badge variant="secondary" className="w-fit">
					Order margin breakdowns
				</Badge>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">
							Average margin
						</CardTitle>
						<Percent className="h-4 w-4 text-muted-foreground" aria-hidden />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatPercent(kpis.avgMarginPercent)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">
							Total revenue
						</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatPaise(kpis.totalRevenuePaise)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Total profit</CardTitle>
						<TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
							{formatPaise(kpis.totalProfitPaise)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">
							Shipping costs
						</CardTitle>
						<Truck className="h-4 w-4 text-muted-foreground" aria-hidden />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatPaise(kpis.totalShippingPaise)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">
							Gateway fees
						</CardTitle>
						<CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatPaise(kpis.totalGatewayFeesPaise)}
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Waterfall</CardTitle>
				</CardHeader>
				<CardContent>
					{aggregateWaterfall.sellingPricePaise === 0 ? (
						<p className="text-sm text-muted-foreground">
							No margin breakdowns in range yet. Enqueue{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-xs">
								compute-order-margins
							</code>{" "}
							jobs to populate data.
						</p>
					) : (
						<MarginWaterfallChart waterfall={aggregateWaterfall} />
					)}
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader className="flex flex-row items-center gap-2">
						<TrendingUp className="h-5 w-5 text-emerald-600" aria-hidden />
						<CardTitle>Top margin products</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Product</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead className="text-right">Margin %</TableHead>
									<TableHead className="text-right">Net profit</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{kpis.topMarginProducts.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={4}
											className="text-center text-muted-foreground"
										>
											No product-level data
										</TableCell>
									</TableRow>
								) : (
									kpis.topMarginProducts.map((p) => (
										<TableRow key={p.productId}>
											<TableCell className="font-medium">{p.name}</TableCell>
											<TableCell className="font-mono text-sm">{p.sku}</TableCell>
											<TableCell className="text-right">
												<Badge variant="secondary">
													{formatPercent(p.marginPercent)}
												</Badge>
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatPaise(p.netProfitPaise)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center gap-2">
						<TrendingDown className="h-5 w-5 text-red-600" aria-hidden />
						<CardTitle>Worst margin products</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Product</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead className="text-right">Margin %</TableHead>
									<TableHead className="text-right">Net profit</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{kpis.worstMarginProducts.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={4}
											className="text-center text-muted-foreground"
										>
											No product-level data
										</TableCell>
									</TableRow>
								) : (
									kpis.worstMarginProducts.map((p) => (
										<TableRow key={p.productId}>
											<TableCell className="font-medium">{p.name}</TableCell>
											<TableCell className="font-mono text-sm">{p.sku}</TableCell>
											<TableCell className="text-right">
												<Badge variant="outline">
													{formatPercent(p.marginPercent)}
												</Badge>
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatPaise(p.netProfitPaise)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
