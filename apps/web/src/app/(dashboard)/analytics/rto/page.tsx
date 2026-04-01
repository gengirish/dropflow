"use client";

import { KPICard } from "@/components/analytics/kpi-card";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	IndianRupee,
	MessageCircle,
	Percent,
	ShoppingCart,
	TrendingDown,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type RtoDashboardKPIs = {
	totalOrders: number;
	codOrders: number;
	prepaidOrders: number;
	rtoCount: number;
	rtoRate: number;
	codToRtoRate: number;
	nudgesSent: number;
	nudgesConverted: number;
	nudgeConversionRate: number;
	estimatedSavingsPaise: number;
	riskDistribution: {
		low: number;
		medium: number;
		high: number;
		critical: number;
	};
};

type ScoreRow = {
	id: string;
	score: number;
	riskLevel: string;
	nudgeSentAt: string | null;
	order: {
		id: string;
		orderNumber: string;
		buyerName: string;
		totalPaise: number;
		paymentMethod: string;
		isRtoNudgeSent: boolean;
		status: string;
		createdAt: string;
	};
};

function unwrapPayload<T>(json: unknown): T | null {
	if (!json || typeof json !== "object") return null;
	const o = json as Record<string, unknown>;
	if (o.success === true && o.data !== undefined) return o.data as T;
	return null;
}

function formatINRFromPaise(paise: number): string {
	const rupees = paise / 100;
	return `₹${rupees.toLocaleString("en-IN", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	})}`;
}

function riskBadgeVariant(
	level: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (level) {
		case "CRITICAL":
			return "destructive";
		case "HIGH":
			return "destructive";
		case "MEDIUM":
			return "secondary";
		default:
			return "outline";
	}
}

export default function RtoAnalyticsPage() {
	const [kpis, setKpis] = useState<RtoDashboardKPIs | null>(null);
	const [rows, setRows] = useState<ScoreRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [analyticsRes, scoreRes] = await Promise.all([
				fetch("/api/v1/rto/analytics"),
				fetch("/api/v1/rto/score?pageSize=30"),
			]);

			const analyticsJson = await analyticsRes.json();
			const scoreJson = await scoreRes.json();

			if (!analyticsRes.ok) {
				const msg =
					(analyticsJson as { error?: { message?: string } })?.error
						?.message ?? "Failed to load analytics";
				throw new Error(msg);
			}
			if (!scoreRes.ok) {
				const msg =
					(scoreJson as { error?: { message?: string } })?.error?.message ??
					"Failed to load scores";
				throw new Error(msg);
			}

			const k = unwrapPayload<RtoDashboardKPIs>(analyticsJson);
			setKpis(k);

			const listData = unwrapPayload<{
				items: ScoreRow[];
			}>(scoreJson);
			setRows(listData?.items ?? []);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const codPct =
		kpis && kpis.totalOrders > 0
			? (kpis.codOrders / kpis.totalOrders) * 100
			: 0;

	const rd = kpis?.riskDistribution;
	const riskTotal =
		(rd?.low ?? 0) +
		(rd?.medium ?? 0) +
		(rd?.high ?? 0) +
		(rd?.critical ?? 0);

	return (
		<div className="space-y-8 p-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">RTO prediction</h1>
				<p className="text-muted-foreground">
					Risk scores, COD nudges, and deliverability signals
				</p>
			</div>

			{error ? (
				<Card className="border-destructive/50">
					<CardHeader>
						<CardTitle className="text-destructive">Could not load</CardTitle>
						<CardDescription>{error}</CardDescription>
					</CardHeader>
				</Card>
			) : null}

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
				<KPICard
					title="Total orders"
					value={loading ? "—" : String(kpis?.totalOrders ?? 0)}
					icon={<ShoppingCart className="h-4 w-4" />}
				/>
				<KPICard
					title="COD %"
					value={
						loading
							? "—"
							: `${codPct.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`
					}
					icon={<Percent className="h-4 w-4" />}
				/>
				<KPICard
					title="RTO rate"
					value={
						loading
							? "—"
							: `${(kpis?.rtoRate ?? 0).toLocaleString("en-IN", {
									maximumFractionDigits: 1,
								})}%`
					}
					subtitle="Returned ÷ all orders"
					icon={<TrendingDown className="h-4 w-4" />}
				/>
				<KPICard
					title="Nudge conversion"
					value={
						loading
							? "—"
							: `${(kpis?.nudgeConversionRate ?? 0).toLocaleString("en-IN", {
									maximumFractionDigits: 1,
								})}%`
					}
					subtitle={`${kpis?.nudgesConverted ?? 0} / ${kpis?.nudgesSent ?? 0} sent`}
					icon={<MessageCircle className="h-4 w-4" />}
				/>
				<KPICard
					title="Est. savings"
					value={
						loading
							? "—"
							: formatINRFromPaise(kpis?.estimatedSavingsPaise ?? 0)
					}
					subtitle="From nudge conversions (reserve %)"
					icon={<IndianRupee className="h-4 w-4" />}
				/>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Risk distribution</CardTitle>
					<CardDescription>
						Scored orders by risk level (from RTO score logs)
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{loading || !rd ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : riskTotal === 0 ? (
						<p className="text-sm text-muted-foreground">
							No scored orders yet. POST to{" "}
							<code className="rounded bg-muted px-1 text-xs">
								/api/v1/rto/score
							</code>{" "}
							to enqueue scoring.
						</p>
					) : (
						(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((label) => {
							const key = label.toLowerCase() as keyof typeof rd;
							const count = rd[key];
							const pct = riskTotal > 0 ? (count / riskTotal) * 100 : 0;
							return (
								<div key={label} className="space-y-1">
									<div className="flex justify-between text-sm">
										<span className="font-medium">{label}</span>
										<span className="text-muted-foreground">
											{count} ({pct.toFixed(0)}%)
										</span>
									</div>
									<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
										<div
											className="h-full bg-primary transition-all"
											style={{ width: `${pct}%` }}
										/>
									</div>
								</div>
							);
						})
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Recent scored orders</CardTitle>
					<CardDescription>
						Latest RTO scores and nudge status for your tenant
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Order</TableHead>
								<TableHead>Buyer</TableHead>
								<TableHead className="text-right">Total</TableHead>
								<TableHead>Payment</TableHead>
								<TableHead className="text-right">Score</TableHead>
								<TableHead>Risk</TableHead>
								<TableHead>Nudge</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell colSpan={7} className="text-muted-foreground">
										Loading…
									</TableCell>
								</TableRow>
							) : rows.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="text-muted-foreground">
										No RTO scores yet.
									</TableCell>
								</TableRow>
							) : (
								rows.map((r) => (
									<TableRow key={r.id}>
										<TableCell className="font-mono text-sm">
											{r.order.orderNumber}
										</TableCell>
										<TableCell>{r.order.buyerName}</TableCell>
										<TableCell className="text-right">
											{formatINRFromPaise(r.order.totalPaise)}
										</TableCell>
										<TableCell>{r.order.paymentMethod}</TableCell>
										<TableCell className="text-right font-medium">
											{r.score.toFixed(0)}
										</TableCell>
										<TableCell>
											<Badge variant={riskBadgeVariant(r.riskLevel)}>
												{r.riskLevel}
											</Badge>
										</TableCell>
										<TableCell>
											{r.order.isRtoNudgeSent || r.nudgeSentAt ? (
												<Badge variant="secondary">Sent</Badge>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
