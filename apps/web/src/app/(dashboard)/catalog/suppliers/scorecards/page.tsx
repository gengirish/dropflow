"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { SupplierScorecardResponse } from "@dropflow/types";
import {
	AlertTriangle,
	ChevronDown,
	ChevronRight,
	Loader2,
	Minus,
	RefreshCw,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";

type SupplierRankingItem = {
	supplierId: string;
	supplierName: string;
	overallScore: number;
	fulfillmentRate: number;
	defectRate: number;
	returnRate: number;
	trend: "up" | "down" | "stable";
};

type IncidentRow = {
	id: string;
	type: string;
	severity: string;
	description: string | null;
	createdAt: string;
	supplier: { id: string; name: string };
};

function currentPeriod(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = d.getUTCMonth() + 1;
	return `${y}-${String(m).padStart(2, "0")}`;
}

function scoreBadgeClass(score: number): string {
	if (score > 80) return "bg-emerald-600 hover:bg-emerald-600 text-white";
	if (score > 60) return "bg-amber-500 hover:bg-amber-500 text-white";
	return "bg-red-600 hover:bg-red-600 text-white";
}

function formatPct(x: number): string {
	return `${(x * 100).toFixed(1)}%`;
}

function TrendIcon({ trend }: { trend: SupplierRankingItem["trend"] }) {
	if (trend === "up") return <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />;
	if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-600" aria-hidden />;
	return <Minus className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

export default function SupplierScorecardsPage() {
	const [period, setPeriod] = useState(currentPeriod);
	const [rankings, setRankings] = useState<SupplierRankingItem[]>([]);
	const [incidents, setIncidents] = useState<IncidentRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [computing, setComputing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [detail, setDetail] = useState<SupplierScorecardResponse | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);

	const loadRankings = useCallback(async () => {
		const res = await fetch(`/api/v1/suppliers/rankings?period=${encodeURIComponent(period)}`);
		const json = await res.json();
		if (!res.ok) {
			throw new Error(json?.error?.message ?? "Failed to load rankings");
		}
		setRankings(json.success ? json.data : []);
	}, [period]);

	const loadIncidents = useCallback(async () => {
		const res = await fetch("/api/v1/suppliers/incidents?pageSize=15");
		const json = await res.json();
		if (!res.ok) return;
		if (json.success && json.data?.items) {
			setIncidents(json.data.items);
		}
	}, []);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			await Promise.all([loadRankings(), loadIncidents()]);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Load failed");
		} finally {
			setLoading(false);
		}
	}, [loadRankings, loadIncidents]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	async function toggleExpand(supplierId: string) {
		if (expandedId === supplierId) {
			setExpandedId(null);
			setDetail(null);
			return;
		}
		setExpandedId(supplierId);
		setDetailLoading(true);
		setDetail(null);
		try {
			const res = await fetch(
				`/api/v1/suppliers/${supplierId}/scorecard?period=${encodeURIComponent(period)}`,
			);
			const json = await res.json();
			if (res.ok && json.success) {
				setDetail(json.data as SupplierScorecardResponse);
			}
		} finally {
			setDetailLoading(false);
		}
	}

	async function computeScorecards() {
		setComputing(true);
		setError(null);
		try {
			const res = await fetch("/api/v1/suppliers/scorecards", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ period }),
			});
			const json = await res.json();
			if (!res.ok) {
				throw new Error(json?.error?.message ?? "Failed to enqueue computation");
			}
			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Computation request failed");
		} finally {
			setComputing(false);
		}
	}

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<div className="mb-1 text-sm text-muted-foreground">
						<Link href="/catalog" className="hover:underline">
							Catalog
						</Link>
						<span className="mx-2">/</span>
						<span>Suppliers</span>
					</div>
					<h1 className="text-2xl font-bold">Supplier scorecards</h1>
					<p className="text-muted-foreground">
						Rankings and quality metrics by period. Expand a row for full detail.
					</p>
				</div>
				<div className="flex flex-wrap items-end gap-3">
					<div className="space-y-1">
						<label htmlFor="period" className="text-sm font-medium">
							Period
						</label>
						<input
							id="period"
							type="month"
							className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
							value={period}
							onChange={(e) => setPeriod(e.target.value)}
						/>
					</div>
					<Button onClick={() => void refresh()} variant="outline" disabled={loading}>
						<RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
						Refresh
					</Button>
					<Button onClick={() => void computeScorecards()} disabled={computing}>
						{computing ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<AlertTriangle className="mr-2 h-4 w-4" />
						)}
						Compute scorecards
					</Button>
				</div>
			</div>

			{error ? (
				<Card className="border-destructive/50">
					<CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
				</Card>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>Supplier ranking</CardTitle>
					<CardDescription>
						Sorted by overall score for {period}. Trend compares to the previous calendar month.
					</CardDescription>
				</CardHeader>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-10" />
								<TableHead>Supplier</TableHead>
								<TableHead className="text-right">Score</TableHead>
								<TableHead className="text-right">Fulfillment</TableHead>
								<TableHead className="text-right">Defect rate</TableHead>
								<TableHead className="text-right">Return rate</TableHead>
								<TableHead className="w-12 text-center">Trend</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
										Loading…
									</TableCell>
								</TableRow>
							) : rankings.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
										No scorecards for this period. Run compute or pick another month.
									</TableCell>
								</TableRow>
							) : (
								rankings.map((r) => (
									<Fragment key={r.supplierId}>
										<TableRow
											className="cursor-pointer hover:bg-muted/50"
											onClick={() => void toggleExpand(r.supplierId)}
										>
											<TableCell className="w-10">
												{expandedId === r.supplierId ? (
													<ChevronDown className="h-4 w-4" />
												) : (
													<ChevronRight className="h-4 w-4" />
												)}
											</TableCell>
											<TableCell className="font-medium">{r.supplierName}</TableCell>
											<TableCell className="text-right">
												<Badge className={scoreBadgeClass(r.overallScore)}>
													{r.overallScore.toFixed(1)}
												</Badge>
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatPct(r.fulfillmentRate)}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatPct(r.defectRate)}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatPct(r.returnRate)}
											</TableCell>
											<TableCell className="text-center">
												<div className="flex justify-center">
													<TrendIcon trend={r.trend} />
												</div>
											</TableCell>
										</TableRow>
										{expandedId === r.supplierId ? (
											<TableRow>
												<TableCell colSpan={7} className="bg-muted/30 p-4">
													{detailLoading ? (
														<p className="text-sm text-muted-foreground">Loading detail…</p>
													) : detail && detail.supplierId === r.supplierId ? (
														<div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
															<div>
																<p className="text-muted-foreground">Period</p>
																<p className="font-medium">{detail.period}</p>
															</div>
															<div>
																<p className="text-muted-foreground">Total POs</p>
																<p className="font-medium">{detail.totalPOs}</p>
															</div>
															<div>
																<p className="text-muted-foreground">On-time / Late</p>
																<p className="font-medium">
																	{detail.onTimePOs} / {detail.latePOs}
																</p>
															</div>
															<div>
																<p className="text-muted-foreground">Total units</p>
																<p className="font-medium">{detail.totalUnits}</p>
															</div>
															<div>
																<p className="text-muted-foreground">Defective units</p>
																<p className="font-medium">{detail.defectiveUnits}</p>
															</div>
															<div>
																<p className="text-muted-foreground">Returned units</p>
																<p className="font-medium">{detail.returnedUnits}</p>
															</div>
															<div>
																<p className="text-muted-foreground">Avg lead time (days)</p>
																<p className="font-medium">
																	{detail.avgLeadTimeDays.toFixed(2)}
																</p>
															</div>
															<div>
																<p className="text-muted-foreground">Promised lead (days)</p>
																<p className="font-medium">{detail.promisedLeadTimeDays}</p>
															</div>
															<div>
																<p className="text-muted-foreground">Overall score</p>
																<p className="font-medium">{detail.overallScore.toFixed(2)}</p>
															</div>
														</div>
													) : (
														<p className="text-sm text-muted-foreground">
															No detailed scorecard for this period.
														</p>
													)}
												</TableCell>
											</TableRow>
										) : null}
									</Fragment>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Recent incidents</CardTitle>
					<CardDescription>Latest supplier quality and delivery incidents.</CardDescription>
				</CardHeader>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Supplier</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Severity</TableHead>
								<TableHead>Description</TableHead>
								<TableHead className="text-right">Date</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{incidents.length === 0 ? (
								<TableRow>
									<TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
										No incidents recorded.
									</TableCell>
								</TableRow>
							) : (
								incidents.map((inc) => (
									<TableRow key={inc.id}>
										<TableCell className="font-medium">{inc.supplier.name}</TableCell>
										<TableCell>
											<Badge variant="outline">{inc.type}</Badge>
										</TableCell>
										<TableCell>{inc.severity}</TableCell>
										<TableCell className="max-w-xs truncate text-muted-foreground">
											{inc.description ?? "—"}
										</TableCell>
										<TableCell className="text-right text-muted-foreground">
											{new Date(inc.createdAt).toLocaleDateString("en-IN")}
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
