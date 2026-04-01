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
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ReorderAlertResponse, StockForecast } from "@dropflow/types";
import { Loader2, Pencil, Play, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type RuleWithProduct = {
	id: string;
	productId: string;
	reorderPoint: number;
	reorderQty: number;
	maxStockQty: number;
	leadTimeDays: number | null;
	isAutoPoEnabled: boolean;
	product: {
		id: string;
		sku: string;
		name: string;
		stockQty: number;
		reservedQty: number;
		salesVelocityDaily: number;
		reorderPoint: number;
		supplierId: string;
	};
};

type CatalogProduct = {
	id: string;
	sku: string;
	name: string;
};

function unwrapData<T>(json: unknown): T | null {
	if (!json || typeof json !== "object") return null;
	const o = json as Record<string, unknown>;
	if (o.success === true && o.data !== undefined) return o.data as T;
	return null;
}

function statusBadgeClass(status: StockForecast["status"]): string {
	switch (status) {
		case "OK":
			return "bg-emerald-600 text-white hover:bg-emerald-600";
		case "WARNING":
			return "bg-amber-500 text-white hover:bg-amber-500";
		case "CRITICAL":
			return "bg-orange-600 text-white hover:bg-orange-600";
		case "STOCKOUT":
			return "bg-red-600 text-white hover:bg-red-600";
		default:
			return "";
	}
}

function formatDays(d: number): string {
	if (!Number.isFinite(d) || d >= 999) return "—";
	return d.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

export default function ReorderPage() {
	const [forecasts, setForecasts] = useState<StockForecast[]>([]);
	const [alerts, setAlerts] = useState<ReorderAlertResponse[]>([]);
	const [rules, setRules] = useState<RuleWithProduct[]>([]);
	const [products, setProducts] = useState<CatalogProduct[]>([]);
	const [loading, setLoading] = useState(true);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingRule, setEditingRule] = useState<RuleWithProduct | null>(null);
	const [formProductId, setFormProductId] = useState("");
	const [formReorderPoint, setFormReorderPoint] = useState("");
	const [formReorderQty, setFormReorderQty] = useState("");
	const [formMaxStock, setFormMaxStock] = useState("0");
	const [formLeadDays, setFormLeadDays] = useState("");
	const [formAutoPo, setFormAutoPo] = useState(false);
	const [savingRule, setSavingRule] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [fcRes, alRes, ruRes, prRes] = await Promise.all([
				fetch("/api/v1/reorder/forecast"),
				fetch("/api/v1/reorder/alerts?acknowledged=false&pageSize=50"),
				fetch("/api/v1/reorder/rules"),
				fetch("/api/v1/catalog/products?pageSize=200"),
			]);

			const fcJson = await fcRes.json();
			const alJson = await alRes.json();
			const ruJson = await ruRes.json();
			const prJson = await prRes.json();

			if (!fcRes.ok) {
				throw new Error(
					(fcJson as { error?: { message?: string } }).error?.message ??
						"Forecast failed",
				);
			}
			if (!alRes.ok) {
				throw new Error(
					(alJson as { error?: { message?: string } }).error?.message ??
						"Alerts failed",
				);
			}
			if (!ruRes.ok) {
				throw new Error(
					(ruJson as { error?: { message?: string } }).error?.message ??
						"Rules failed",
				);
			}
			if (!prRes.ok) {
				throw new Error(
					(prJson as { error?: { message?: string } }).error?.message ??
						"Products failed",
				);
			}

			setForecasts(unwrapData<StockForecast[]>(fcJson) ?? []);
			const alertPayload = unwrapData<{ items: ReorderAlertResponse[] }>(alJson);
			setAlerts(alertPayload?.items ?? []);
			setRules(unwrapData<RuleWithProduct[]>(ruJson) ?? []);
			const prodPayload = unwrapData<{ items: CatalogProduct[] }>(prJson);
			setProducts(prodPayload?.items ?? []);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const ruleProductIds = useMemo(() => new Set(rules.map((r) => r.productId)), [rules]);

	const productsWithoutRule = useMemo(
		() => products.filter((p) => !ruleProductIds.has(p.id)),
		[products, ruleProductIds],
	);

	function openCreateDialog() {
		setEditingRule(null);
		setFormProductId("");
		setFormReorderPoint("");
		setFormReorderQty("");
		setFormMaxStock("0");
		setFormLeadDays("");
		setFormAutoPo(false);
		setDialogOpen(true);
	}

	function openEditDialog(rule: RuleWithProduct) {
		setEditingRule(rule);
		setFormProductId(rule.productId);
		setFormReorderPoint(String(rule.reorderPoint));
		setFormReorderQty(String(rule.reorderQty));
		setFormMaxStock(String(rule.maxStockQty));
		setFormLeadDays(rule.leadTimeDays != null ? String(rule.leadTimeDays) : "");
		setFormAutoPo(rule.isAutoPoEnabled);
		setDialogOpen(true);
	}

	async function saveRule() {
		const reorderPoint = Number(formReorderPoint);
		const reorderQty = Number(formReorderQty);
		const maxStockQty = Number(formMaxStock) || 0;
		if (!editingRule && !formProductId) return;
		if (!Number.isFinite(reorderPoint) || reorderPoint < 0) return;
		if (!Number.isFinite(reorderQty) || reorderQty < 1) return;

		setSavingRule(true);
		try {
			const leadParsed = formLeadDays.trim() === "" ? undefined : Number(formLeadDays);
			const leadTimeDays =
				leadParsed !== undefined && Number.isFinite(leadParsed) && leadParsed > 0
					? leadParsed
					: undefined;

			if (editingRule) {
				const res = await fetch(`/api/v1/reorder/rules/${editingRule.productId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						reorderPoint,
						reorderQty,
						maxStockQty,
						leadTimeDays,
						isAutoPoEnabled: formAutoPo,
					}),
				});
				const json = await res.json();
				if (!res.ok) {
					throw new Error(
						(json as { error?: { message?: string } }).error?.message ?? "Save failed",
					);
				}
			} else {
				const res = await fetch("/api/v1/reorder/rules", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						productId: formProductId,
						reorderPoint,
						reorderQty,
						maxStockQty,
						leadTimeDays,
						isAutoPoEnabled: formAutoPo,
					}),
				});
				const json = await res.json();
				if (!res.ok) {
					throw new Error(
						(json as { error?: { message?: string } }).error?.message ?? "Save failed",
					);
				}
			}
			setDialogOpen(false);
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Save failed");
		} finally {
			setSavingRule(false);
		}
	}

	async function deleteRule(productId: string) {
		if (!window.confirm("Remove this reorder rule?")) return;
		try {
			const res = await fetch(`/api/v1/reorder/rules/${productId}`, {
				method: "DELETE",
			});
			const json = await res.json();
			if (!res.ok) {
				throw new Error(
					(json as { error?: { message?: string } }).error?.message ?? "Delete failed",
				);
			}
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Delete failed");
		}
	}

	async function acknowledge(alertId: string) {
		try {
			const res = await fetch("/api/v1/reorder/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ alertId }),
			});
			const json = await res.json();
			if (!res.ok) {
				throw new Error(
					(json as { error?: { message?: string } }).error?.message ?? "Ack failed",
				);
			}
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Ack failed");
		}
	}

	async function runReorderCheck() {
		setRunning(true);
		setError(null);
		try {
			const res = await fetch("/api/v1/reorder/run", { method: "POST" });
			const json = await res.json();
			if (!res.ok) {
				throw new Error(
					(json as { error?: { message?: string } }).error?.message ?? "Run failed",
				);
			}
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Run failed");
		} finally {
			setRunning(false);
		}
	}

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Smart reorder</h1>
					<p className="text-muted-foreground">
						Velocity-based forecasts, alerts, and reorder rules
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={() => void load()} disabled={loading}>
						<RefreshCw
							className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
							aria-hidden
						/>
						Refresh
					</Button>
					<Button onClick={() => void runReorderCheck()} disabled={running || loading}>
						{running ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
						) : (
							<Play className="mr-2 h-4 w-4" aria-hidden />
						)}
						Run reorder check
					</Button>
				</div>
			</div>

			{error ? (
				<Card className="border-destructive/50">
					<CardHeader>
						<CardTitle className="text-destructive text-base">Error</CardTitle>
						<CardDescription>{error}</CardDescription>
					</CardHeader>
				</Card>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>Stock forecast</CardTitle>
					<CardDescription>
						Products with reorder rules — days remaining from current velocity
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Product</TableHead>
								<TableHead>SKU</TableHead>
								<TableHead className="text-right">Stock</TableHead>
								<TableHead className="text-right">Velocity / day</TableHead>
								<TableHead className="text-right">Days left</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Stockout date</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell colSpan={7} className="text-muted-foreground">
										Loading…
									</TableCell>
								</TableRow>
							) : forecasts.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="text-muted-foreground">
										No reorder rules yet. Add a rule below to see forecasts.
									</TableCell>
								</TableRow>
							) : (
								forecasts.map((f) => (
									<TableRow key={f.productId}>
										<TableCell className="font-medium">{f.productName}</TableCell>
										<TableCell className="text-muted-foreground">{f.sku}</TableCell>
										<TableCell className="text-right tabular-nums">
											{f.currentStock}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{f.salesVelocityDaily.toLocaleString("en-IN", {
												maximumFractionDigits: 2,
											})}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{formatDays(f.daysOfStockRemaining)}
										</TableCell>
										<TableCell>
											<Badge className={statusBadgeClass(f.status)}>{f.status}</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{f.stockoutDate ?? "—"}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Active alerts</CardTitle>
					<CardDescription>Unacknowledged reorder alerts</CardDescription>
				</CardHeader>
				<CardContent>
					{alerts.length === 0 && !loading ? (
						<p className="text-muted-foreground text-sm">No active alerts.</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Product</TableHead>
									<TableHead className="text-right">Stock</TableHead>
									<TableHead className="text-right">Suggested qty</TableHead>
									<TableHead>Auto PO</TableHead>
									<TableHead className="w-[140px]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{alerts.map((a) => (
									<TableRow key={a.id}>
										<TableCell>
											<div className="font-medium">{a.productName}</div>
											<div className="text-muted-foreground text-xs">{a.sku}</div>
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{a.currentStock}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{a.suggestedQty}
										</TableCell>
										<TableCell>
											{a.autoPoCreated ? (
												<Badge variant="secondary">Created</Badge>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell>
											<Button
												size="sm"
												variant="outline"
												onClick={() => void acknowledge(a.id)}
											>
												Acknowledge
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0">
					<div>
						<CardTitle>Reorder rules</CardTitle>
						<CardDescription>Thresholds and optional auto purchase orders</CardDescription>
					</div>
					<Button size="sm" onClick={openCreateDialog}>
						Add rule
					</Button>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Product</TableHead>
								<TableHead className="text-right">Reorder point</TableHead>
								<TableHead className="text-right">Reorder qty</TableHead>
								<TableHead>Auto PO</TableHead>
								<TableHead className="w-[100px]" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{rules.length === 0 && !loading ? (
								<TableRow>
									<TableCell colSpan={5} className="text-muted-foreground">
										No rules yet.
									</TableCell>
								</TableRow>
							) : (
								rules.map((r) => (
									<TableRow key={r.id}>
										<TableCell>
											<div className="font-medium">{r.product.name}</div>
											<div className="text-muted-foreground text-xs">
												{r.product.sku}
											</div>
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{r.reorderPoint}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{r.reorderQty}
										</TableCell>
										<TableCell>
											{r.isAutoPoEnabled ? (
												<Badge variant="secondary">On</Badge>
											) : (
												<span className="text-muted-foreground">Off</span>
											)}
										</TableCell>
										<TableCell>
											<div className="flex gap-1">
												<Button
													size="icon"
													variant="ghost"
													className="h-8 w-8"
													aria-label="Edit rule"
													onClick={() => openEditDialog(r)}
												>
													<Pencil className="h-4 w-4" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													className="h-8 w-8"
													aria-label="Delete rule"
													onClick={() => void deleteRule(r.productId)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{editingRule ? "Edit rule" : "Add reorder rule"}</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						{editingRule ? (
							<div className="text-muted-foreground text-sm">
								{editingRule.product.name} ({editingRule.product.sku})
							</div>
						) : (
							<div className="grid gap-2">
								<Label>Product</Label>
								<Select value={formProductId} onValueChange={setFormProductId}>
									<SelectTrigger>
										<SelectValue placeholder="Select product" />
									</SelectTrigger>
									<SelectContent>
										{productsWithoutRule.map((p) => (
											<SelectItem key={p.id} value={p.id}>
												{p.name} ({p.sku})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
						<div className="grid gap-2">
							<Label htmlFor="rp">Reorder point (units)</Label>
							<Input
								id="rp"
								type="number"
								min={0}
								value={formReorderPoint}
								onChange={(e) => setFormReorderPoint(e.target.value)}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="rq">Reorder quantity</Label>
							<Input
								id="rq"
								type="number"
								min={1}
								value={formReorderQty}
								onChange={(e) => setFormReorderQty(e.target.value)}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="mx">Max stock qty</Label>
							<Input
								id="mx"
								type="number"
								min={0}
								value={formMaxStock}
								onChange={(e) => setFormMaxStock(e.target.value)}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="ld">Lead time override (days, optional)</Label>
							<Input
								id="ld"
								type="number"
								min={1}
								placeholder="Use supplier default if empty"
								value={formLeadDays}
								onChange={(e) => setFormLeadDays(e.target.value)}
							/>
						</div>
						<div className="flex items-center gap-2">
							<input
								id="auto"
								type="checkbox"
								className="h-4 w-4 rounded border"
								checked={formAutoPo}
								onChange={(e) => setFormAutoPo(e.target.checked)}
							/>
							<Label htmlFor="auto" className="font-normal">
								Auto-create purchase order when alerted
							</Label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={() => void saveRule()}
							disabled={
								savingRule ||
								!formReorderPoint ||
								!formReorderQty ||
								(!editingRule && !formProductId)
							}
						>
							{savingRule ? (
								<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							) : (
								"Save"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
