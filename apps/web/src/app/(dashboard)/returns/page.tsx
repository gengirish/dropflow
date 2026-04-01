"use client";

import { KPICard } from "@/components/analytics/kpi-card";
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
	DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import type { CreateReturnInput } from "@dropflow/types";
import {
	BarChart3,
	CalendarClock,
	CheckCircle2,
	ListOrdered,
	Package,
	Percent,
	Plus,
	RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ReturnDashboardKPIs = {
	totalReturns: number;
	pendingReturns: number;
	returnRate: number;
	avgResolutionDays: number;
	totalRefundedPaise: number;
	qcPassRate: number;
	restockRate: number;
	topReturnReasons: { reason: string; count: number; percent: number }[];
};

type ReturnRow = {
	id: string;
	returnNumber: string;
	status: string;
	reason: string;
	createdAt: string;
	itemCount: number;
	order: { id: string; orderNumber: string; status: string };
	refund: { id: string; status: string; amountPaise: number } | null;
};

const REASONS = [
	"DEFECTIVE",
	"WRONG_ITEM",
	"SIZE_ISSUE",
	"DAMAGED_IN_TRANSIT",
	"NOT_AS_DESCRIBED",
	"CHANGED_MIND",
	"OTHER",
] as const;

function unwrapData<T>(json: unknown): T | null {
	if (!json || typeof json !== "object") return null;
	const o = json as Record<string, unknown>;
	if (o.success === true && o.data !== undefined) return o.data as T;
	return null;
}

function unwrapPaginated<T>(
	json: unknown,
): { items: T[]; total: number } | null {
	const d = unwrapData<{ items: T[]; total: number }>(json);
	return d?.items ? d : null;
}

function formatINRFromPaise(paise: number): string {
	const rupees = paise / 100;
	return `₹${rupees.toLocaleString("en-IN", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	})}`;
}

function statusBadgeVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "REFUND_COMPLETED":
		case "QC_PASSED":
		case "APPROVED":
			return "default";
		case "REJECTED":
		case "QC_FAILED":
			return "destructive";
		case "REQUESTED":
		case "PICKUP_SCHEDULED":
		case "PICKED_UP":
		case "RECEIVED":
		case "REFUND_INITIATED":
			return "secondary";
		default:
			return "outline";
	}
}

export default function ReturnsPage() {
	const [kpis, setKpis] = useState<ReturnDashboardKPIs | null>(null);
	const [rows, setRows] = useState<ReturnRow[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pickupOpen, setPickupOpen] = useState(false);
	const [pickupId, setPickupId] = useState<string | null>(null);
	const [awb, setAwb] = useState("");
	const [carrier, setCarrier] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [orderIdInput, setOrderIdInput] = useState("");
	const [orderLoading, setOrderLoading] = useState(false);
	const [orderJson, setOrderJson] = useState<{
		id: string;
		items: {
			id: string;
			productId: string;
			quantity: number;
			product: { name: string; sku: string };
		}[];
	} | null>(null);
	const [createReason, setCreateReason] =
		useState<(typeof REASONS)[number]>("OTHER");
	const [customerNotes, setCustomerNotes] = useState("");
	const [lineQty, setLineQty] = useState<Record<string, number>>({});
	const [lineReason, setLineReason] = useState<
		Record<string, (typeof REASONS)[number]>
	>({});

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [kRes, lRes] = await Promise.all([
				fetch("/api/v1/returns/analytics?days=30"),
				fetch("/api/v1/returns?page=1&pageSize=50"),
			]);
			const kj = await kRes.json();
			const lj = await lRes.json();
			const k = unwrapData<ReturnDashboardKPIs>(kj);
			const p = unwrapPaginated<ReturnRow>(lj);
			if (!k || !p) {
				setError("Failed to load returns data");
				return;
			}
			setKpis(k);
			setRows(p.items);
			setTotal(p.total);
		} catch {
			setError("Failed to load returns data");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function patchStatus(id: string, body: object) {
		setError(null);
		const res = await fetch(`/api/v1/returns/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const json = await res.json();
		if (!json.success) {
			throw new Error(json?.error?.message ?? "Update failed");
		}
		if (res.status === 202) {
			await new Promise((r) => setTimeout(r, 800));
		}
		await load();
	}

	function openPickup(id: string) {
		setPickupId(id);
		setAwb("");
		setCarrier("");
		setPickupOpen(true);
	}

	async function submitPickup() {
		if (!pickupId) return;
		await patchStatus(pickupId, {
			status: "PICKUP_SCHEDULED",
			returnAwbNumber: awb || undefined,
			returnCarrier: carrier || undefined,
		});
		setPickupOpen(false);
	}

	async function loadOrderForCreate() {
		if (!orderIdInput.trim()) return;
		setOrderLoading(true);
		try {
			const res = await fetch(`/api/v1/orders/${orderIdInput.trim()}`);
			const json = await res.json();
			const data = unwrapData<{
				id: string;
				items: {
					id: string;
					productId: string;
					quantity: number;
					product: { name: string; sku: string };
				}[];
			}>(json);
			if (!data) {
				setOrderJson(null);
				setError("Order not found");
				return;
			}
			setOrderJson(data);
			const qty: Record<string, number> = {};
			const rs: Record<string, (typeof REASONS)[number]> = {};
			for (const it of data.items) {
				qty[it.id] = it.quantity;
				rs[it.id] = createReason;
			}
			setLineQty(qty);
			setLineReason(rs);
		} finally {
			setOrderLoading(false);
		}
	}

	async function submitCreate() {
		if (!orderJson) return;
		const items = orderJson.items
			.map((it) => {
				const quantity = lineQty[it.id] ?? 0;
				if (quantity <= 0) return null;
				return {
					orderItemId: it.id,
					productId: it.productId,
					quantity,
					reason: lineReason[it.id] ?? createReason,
				};
			})
			.filter((row): row is NonNullable<typeof row> => row !== null);
		if (items.length === 0) {
			setError("Select at least one line with quantity");
			return;
		}
		const body: CreateReturnInput = {
			orderId: orderJson.id,
			reason: createReason,
			customerNotes: customerNotes || undefined,
			items,
		};
		const res = await fetch("/api/v1/returns", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const json = await res.json();
		if (!json.success) {
			setError(json?.error?.message ?? "Create failed");
			return;
		}
		setCreateOpen(false);
		setOrderJson(null);
		setOrderIdInput("");
		await load();
	}

	const maxReasonPct =
		kpis?.topReturnReasons?.length && kpis.topReturnReasons[0]
			? Math.max(...kpis.topReturnReasons.map((r) => r.percent), 1)
			: 1;

	return (
		<div className="space-y-8">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">
						Returns &amp; refunds
					</h1>
					<p className="text-sm text-muted-foreground">
						Track return requests, QC, and refunds (last 30 days for KPIs).
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => void load()}
						disabled={loading}
					>
						Refresh
					</Button>
					<Dialog
						open={createOpen}
						onOpenChange={(o) => {
							setCreateOpen(o);
							if (!o) {
								setOrderJson(null);
								setOrderIdInput("");
							}
						}}
					>
						<DialogTrigger asChild>
							<Button size="sm">
								<Plus className="mr-2 h-4 w-4" aria-hidden />
								New return
							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
							<DialogHeader>
								<DialogTitle>Create return request</DialogTitle>
							</DialogHeader>
							<div className="grid gap-4 py-2">
								<div className="grid gap-2">
									<Label htmlFor="orderId">Order ID</Label>
									<div className="flex gap-2">
										<Input
											id="orderId"
											value={orderIdInput}
											onChange={(e) => setOrderIdInput(e.target.value)}
											placeholder="Order cuid"
										/>
										<Button
											type="button"
											variant="secondary"
											onClick={() => void loadOrderForCreate()}
											disabled={orderLoading}
										>
											Load
										</Button>
									</div>
								</div>
								{orderJson ? (
									<>
										<div className="grid gap-2">
											<Label>Primary reason</Label>
											<Select
												value={createReason}
												onValueChange={(v) =>
													setCreateReason(v as (typeof REASONS)[number])
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{REASONS.map((r) => (
														<SelectItem key={r} value={r}>
															{r.replace(/_/g, " ")}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="grid gap-2">
											<Label htmlFor="notes">Customer notes</Label>
											<Textarea
												id="notes"
												value={customerNotes}
												onChange={(e) => setCustomerNotes(e.target.value)}
												rows={2}
											/>
										</div>
										<p className="text-sm font-medium">Lines to return</p>
										<ul className="space-y-3">
											{orderJson.items.map((it) => (
												<li
													key={it.id}
													className="rounded-md border p-3 text-sm"
												>
													<div className="font-medium">{it.product.name}</div>
													<div className="text-muted-foreground">
														SKU {it.product.sku} · ordered {it.quantity}
													</div>
													<div className="mt-2 flex flex-wrap items-center gap-2">
														<Label className="w-24">Qty</Label>
														<Input
															type="number"
															min={0}
															max={it.quantity}
															className="w-24"
															value={lineQty[it.id] ?? 0}
															onChange={(e) =>
																setLineQty((prev) => ({
																	...prev,
																	[it.id]: Number(e.target.value),
																}))
															}
														/>
														<Select
															value={lineReason[it.id] ?? createReason}
															onValueChange={(v) =>
																setLineReason((prev) => ({
																	...prev,
																	[it.id]: v as (typeof REASONS)[number],
																}))
															}
														>
															<SelectTrigger className="w-[200px]">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{REASONS.map((r) => (
																	<SelectItem key={r} value={r}>
																		{r.replace(/_/g, " ")}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
												</li>
											))}
										</ul>
									</>
								) : null}
							</div>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => setCreateOpen(false)}
								>
									Cancel
								</Button>
								<Button
									type="button"
									onClick={() => void submitCreate()}
									disabled={!orderJson}
								>
									Submit return
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}

			{kpis ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					<KPICard
						title="Total returns"
						value={String(kpis.totalReturns)}
						subtitle={`Last 30 days · refunded ${formatINRFromPaise(kpis.totalRefundedPaise)}`}
						icon={<RotateCcw className="h-4 w-4" aria-hidden />}
					/>
					<KPICard
						title="Pending returns"
						value={String(kpis.pendingReturns)}
						icon={<ListOrdered className="h-4 w-4" aria-hidden />}
					/>
					<KPICard
						title="Return rate"
						value={`${kpis.returnRate.toFixed(1)}%`}
						subtitle="vs orders (30d)"
						icon={<Percent className="h-4 w-4" aria-hidden />}
					/>
					<KPICard
						title="Avg resolution"
						value={`${kpis.avgResolutionDays}d`}
						subtitle="Completed returns"
						icon={<CalendarClock className="h-4 w-4" aria-hidden />}
					/>
					<KPICard
						title="QC pass rate"
						value={`${kpis.qcPassRate}%`}
						subtitle={`Restock ${kpis.restockRate}%`}
						icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
					/>
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-3">
				<Card className="lg:col-span-1">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<BarChart3 className="h-4 w-4" aria-hidden />
							Return reasons
						</CardTitle>
						<CardDescription>Share of return volume (30d)</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{kpis?.topReturnReasons?.length ? (
							kpis.topReturnReasons.map((r) => (
								<div key={r.reason}>
									<div className="mb-1 flex justify-between text-xs">
										<span>{r.reason.replace(/_/g, " ")}</span>
										<span className="text-muted-foreground">
											{r.count} ({r.percent.toFixed(0)}%)
										</span>
									</div>
									<div className="h-2 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full bg-primary transition-all"
											style={{
												width: `${Math.min(100, (r.percent / maxReasonPct) * 100)}%`,
											}}
										/>
									</div>
								</div>
							))
						) : (
							<p className="text-sm text-muted-foreground">
								No return data yet.
							</p>
						)}
					</CardContent>
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
						<div>
							<CardTitle className="flex items-center gap-2 text-base">
								<Package className="h-4 w-4" aria-hidden />
								Returns
							</CardTitle>
							<CardDescription>
								{total} total · click a row for detail
							</CardDescription>
						</div>
					</CardHeader>
					<CardContent className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Return #</TableHead>
									<TableHead>Order</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Reason</TableHead>
									<TableHead className="text-right">Items</TableHead>
									<TableHead>Refund</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading ? (
									<TableRow>
										<TableCell colSpan={8} className="text-muted-foreground">
											Loading…
										</TableCell>
									</TableRow>
								) : rows.length === 0 ? (
									<TableRow>
										<TableCell colSpan={8} className="text-muted-foreground">
											No returns yet.
										</TableCell>
									</TableRow>
								) : (
									rows.map((r) => (
										<TableRow key={r.id}>
											<TableCell className="font-medium">
												<Link
													href={`/returns/${r.id}`}
													className="text-primary underline-offset-4 hover:underline"
												>
													{r.returnNumber}
												</Link>
											</TableCell>
											<TableCell>{r.order.orderNumber}</TableCell>
											<TableCell>
												<Badge variant={statusBadgeVariant(r.status)}>
													{r.status}
												</Badge>
											</TableCell>
											<TableCell className="max-w-[140px] truncate text-muted-foreground">
												{r.reason.replace(/_/g, " ")}
											</TableCell>
											<TableCell className="text-right">
												{r.itemCount}
											</TableCell>
											<TableCell>
												{r.refund ? (
													<span className="text-xs">
														<Badge variant="outline" className="mr-1">
															{r.refund.status}
														</Badge>
														{r.refund.status === "COMPLETED"
															? formatINRFromPaise(r.refund.amountPaise)
															: "—"}
													</span>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell className="whitespace-nowrap text-xs text-muted-foreground">
												{new Date(r.createdAt).toLocaleDateString()}
											</TableCell>
											<TableCell>
												<div className="flex flex-wrap justify-end gap-1">
													{r.status === "REQUESTED" ? (
														<Button
															size="sm"
															variant="outline"
															className="h-7 text-xs"
															onClick={() =>
																void patchStatus(r.id, {
																	status: "APPROVED",
																}).catch((err: Error) => setError(err.message))
															}
														>
															Approve
														</Button>
													) : null}
													{r.status === "APPROVED" ? (
														<Button
															size="sm"
															variant="outline"
															className="h-7 text-xs"
															onClick={() => openPickup(r.id)}
														>
															Schedule pickup
														</Button>
													) : null}
													{r.status === "PICKUP_SCHEDULED" ? (
														<Button
															size="sm"
															variant="outline"
															className="h-7 text-xs"
															onClick={() =>
																void patchStatus(r.id, {
																	status: "PICKED_UP",
																}).catch((err: Error) => setError(err.message))
															}
														>
															Mark picked up
														</Button>
													) : null}
													{r.status === "PICKED_UP" ? (
														<Button
															size="sm"
															variant="outline"
															className="h-7 text-xs"
															onClick={() =>
																void patchStatus(r.id, {
																	status: "RECEIVED",
																}).catch((err: Error) => setError(err.message))
															}
														>
															Mark received
														</Button>
													) : null}
													{r.status === "RECEIVED" ? (
														<>
															<Button
																size="sm"
																variant="outline"
																className="h-7 text-xs"
																onClick={() =>
																	void patchStatus(r.id, {
																		status: "QC_PASSED",
																		qcNotes: "QC pass (list)",
																	}).catch((err: Error) =>
																		setError(err.message),
																	)
																}
															>
																QC pass
															</Button>
															<Button
																size="sm"
																variant="outline"
																className="h-7 text-xs"
																onClick={() =>
																	void patchStatus(r.id, {
																		status: "QC_FAILED",
																		qcNotes: "QC fail (list)",
																	}).catch((err: Error) =>
																		setError(err.message),
																	)
																}
															>
																QC fail
															</Button>
														</>
													) : null}
													{r.status === "QC_PASSED" ? (
														<Button
															size="sm"
															variant="default"
															className="h-7 text-xs"
															asChild
														>
															<Link href={`/returns/${r.id}`}>Refund</Link>
														</Button>
													) : null}
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>

			<Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Schedule pickup</DialogTitle>
					</DialogHeader>
					<div className="grid gap-3 py-2">
						<div className="grid gap-2">
							<Label htmlFor="awb">Return AWB (optional)</Label>
							<Input
								id="awb"
								value={awb}
								onChange={(e) => setAwb(e.target.value)}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="carrier">Carrier (optional)</Label>
							<Input
								id="carrier"
								value={carrier}
								onChange={(e) => setCarrier(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setPickupOpen(false)}
						>
							Cancel
						</Button>
						<Button type="button" onClick={() => void submitPickup()}>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
