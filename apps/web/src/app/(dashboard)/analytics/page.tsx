"use client";

import { KPICard } from "@/components/analytics/kpi-card";
import { RevenueChart } from "@/components/analytics/revenue-chart";
import {
	SkuTable,
	type SkuEconomicsRow,
} from "@/components/analytics/sku-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatPaiseINR } from "@/lib/utils";
import {
	IndianRupee,
	Package,
	Percent,
	RotateCcw,
	ShoppingCart,
	TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardPayload = {
	totalRevenuePaise: number;
	totalProfitPaise: number;
	avgMarginPercent: number;
	totalOrders: number;
	returnRate: number;
	avgOrderValuePaise: number;
	revenueGrowthPercent: number;
	topSkus: SkuEconomicsRow[];
	worstSkus: SkuEconomicsRow[];
};

type RevenuePoint = {
	date: string;
	revenuePaise: number;
	profitPaise: number;
	orderCount: number;
	cogsPaise: number;
};

function unwrapPayload<T>(json: unknown): T | null {
	if (!json || typeof json !== "object") return null;
	const o = json as Record<string, unknown>;
	if (o.success === true && o.data !== undefined) return o.data as T;
	return json as T;
}

function asArray<T>(payload: unknown): T[] {
	if (Array.isArray(payload)) return payload as T[];
	if (
		payload &&
		typeof payload === "object" &&
		Array.isArray((payload as { items?: unknown }).items)
	) {
		return (payload as { items: T[] }).items;
	}
	return [];
}

function currentPeriodYm(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${mo}`;
}

function formatReturnRate(rate: number): string {
	return `${rate.toFixed(2)}%`;
}

export default function AnalyticsPage() {
	const [loading, setLoading] = useState(true);
	const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
	const [revenueItems, setRevenueItems] = useState<RevenuePoint[]>([]);
	const [unitItems, setUnitItems] = useState<SkuEconomicsRow[]>([]);
	const [skuTab, setSkuTab] = useState<"top" | "worst">("top");

	const load = useCallback(async () => {
		setLoading(true);
		const to = new Date();
		const from = new Date();
		from.setDate(from.getDate() - 30);
		const fromStr = from.toISOString().slice(0, 10);
		const toStr = to.toISOString().slice(0, 10);

		const revenueUrl = `/api/v1/analytics/revenue?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&granularity=DAILY`;
		const period = currentPeriodYm();
		const unitUrl = `/api/v1/analytics/unit-economics?period=${encodeURIComponent(period)}&sortBy=margin&sortOrder=desc&limit=100`;

		try {
			const [dRes, rRes, uRes] = await Promise.all([
				fetch("/api/v1/analytics/dashboard"),
				fetch(revenueUrl),
				fetch(unitUrl),
			]);

			const dJson = dRes.ok ? await dRes.json() : null;
			const rJson = rRes.ok ? await rRes.json() : null;
			const uJson = uRes.ok ? await uRes.json() : null;

			const d = unwrapPayload<DashboardPayload>(dJson);
			const rData = unwrapPayload<unknown>(rJson);
			const uData = unwrapPayload<unknown>(uJson);

			setDashboard(d);
			setRevenueItems(asArray<RevenuePoint>(rData));
			setUnitItems(asArray<SkuEconomicsRow>(uData));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const topSkus = useMemo(() => {
		if (unitItems.length > 0) {
			return [...unitItems]
				.sort((a, b) => b.marginPercent - a.marginPercent)
				.slice(0, 25);
		}
		return dashboard?.topSkus ?? [];
	}, [unitItems, dashboard?.topSkus]);

	const worstSkus = useMemo(() => {
		if (unitItems.length > 0) {
			return [...unitItems]
				.sort((a, b) => a.marginPercent - b.marginPercent)
				.slice(0, 25);
		}
		return dashboard?.worstSkus ?? [];
	}, [unitItems, dashboard?.worstSkus]);

	const skuTableItems = skuTab === "top" ? topSkus : worstSkus;

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Analytics</h1>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{loading ? (
					<>
						{Array.from({ length: 4 }).map((_, i) => (
							<Card key={i}>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<div className="h-4 w-24 animate-pulse rounded bg-muted" />
									<div className="h-4 w-4 animate-pulse rounded bg-muted" />
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="h-8 w-32 animate-pulse rounded bg-muted" />
									<div className="h-3 w-20 animate-pulse rounded bg-muted" />
								</CardContent>
							</Card>
						))}
					</>
				) : (
					<>
						<KPICard
							title="Total revenue"
							value={formatPaiseINR(dashboard?.totalRevenuePaise ?? 0)}
							subtitle={
								dashboard?.revenueGrowthPercent !== undefined
									? "Vs prior period"
									: undefined
							}
							trend={dashboard?.revenueGrowthPercent}
							icon={<IndianRupee className="h-4 w-4" />}
						/>
						<KPICard
							title="Net profit"
							value={formatPaiseINR(dashboard?.totalProfitPaise ?? 0)}
							icon={<TrendingUp className="h-4 w-4" />}
						/>
						<KPICard
							title="Avg margin"
							value={`${(dashboard?.avgMarginPercent ?? 0).toFixed(1)}%`}
							icon={<Percent className="h-4 w-4" />}
						/>
						<KPICard
							title="Total orders"
							value={(dashboard?.totalOrders ?? 0).toLocaleString("en-IN")}
							icon={<ShoppingCart className="h-4 w-4" />}
						/>
					</>
				)}
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{loading ? (
					<>
						<Card>
							<CardHeader className="pb-2">
								<div className="h-4 w-28 animate-pulse rounded bg-muted" />
							</CardHeader>
							<CardContent>
								<div className="h-8 w-20 animate-pulse rounded bg-muted" />
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<div className="h-4 w-36 animate-pulse rounded bg-muted" />
							</CardHeader>
							<CardContent>
								<div className="h-8 w-28 animate-pulse rounded bg-muted" />
							</CardContent>
						</Card>
					</>
				) : (
					<>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Return rate
								</CardTitle>
								<RotateCcw className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{formatReturnRate(dashboard?.returnRate ?? 0)}
								</div>
								<p className="text-xs text-muted-foreground">
									Returned orders as a share of all orders (last 30 days)
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Avg order value
								</CardTitle>
								<Package className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{formatPaiseINR(dashboard?.avgOrderValuePaise ?? 0)}
								</div>
								<p className="text-xs text-muted-foreground">
									Mean revenue per order in the window
								</p>
							</CardContent>
						</Card>
					</>
				)}
			</div>

			<RevenueChart data={revenueItems} loading={loading} />

			<Card>
				<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<CardTitle>SKU economics</CardTitle>
					<div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
						<button
							type="button"
							onClick={() => setSkuTab("top")}
							className={cn(
								"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
								skuTab === "top"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							Top performers
						</button>
						<button
							type="button"
							onClick={() => setSkuTab("worst")}
							className={cn(
								"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
								skuTab === "worst"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							Needs attention
						</button>
					</div>
				</CardHeader>
				<CardContent>
					<SkuTable items={skuTableItems} loading={loading} />
				</CardContent>
			</Card>
		</div>
	);
}
