"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReconciliationDashboardKPIs } from "@dropflow/types";
import {
	AlertCircle,
	ArrowLeft,
	BarChart3,
	CreditCard,
	FileJson,
	GitMerge,
	IndianRupee,
	Loader2,
	Truck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatINR(paise: number) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 2,
	}).format(paise / 100);
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		timeZone: "Asia/Kolkata",
	});
}

function typeLabel(t: string) {
	if (t === "PAYMENT_GATEWAY") return "Payment Gateway";
	if (t === "COD_CARRIER") return "COD Carrier";
	return t;
}

function statusBadge(status: string) {
	const base = "font-medium";
	switch (status) {
		case "MATCHED":
			return (
				<Badge
					className={`${base} border-transparent bg-emerald-600 text-white hover:bg-emerald-600`}
				>
					MATCHED
				</Badge>
			);
		case "UNMATCHED":
			return (
				<Badge
					className={`${base} border-transparent bg-amber-500 text-amber-950 hover:bg-amber-500`}
				>
					UNMATCHED
				</Badge>
			);
		case "DISCREPANCY":
			return (
				<Badge
					className={`${base} border-transparent bg-red-600 text-white hover:bg-red-600`}
				>
					DISCREPANCY
				</Badge>
			);
		case "MANUAL_OVERRIDE":
			return (
				<Badge
					className={`${base} border-transparent bg-blue-600 text-white hover:bg-blue-600`}
				>
					MANUAL
				</Badge>
			);
		default:
			return <Badge variant="secondary">{status}</Badge>;
	}
}

type SettlementRow = {
	id: string;
	gateway: string;
	settlementId: string;
	settlementDate: string;
	totalAmountPaise: number;
	netAmountPaise: number;
	status: string;
	itemCount: number;
	matchedCount: number;
	unmatchedCount: number;
};

type CodRow = {
	id: string;
	carrier: string;
	remittanceId: string;
	remittanceDate: string;
	totalAmountPaise: number;
	netAmountPaise: number;
	status: string;
	itemCount: number;
	matchedCount: number;
	unmatchedCount: number;
};

type RecordRow = {
	id: string;
	type: string;
	referenceId: string;
	matchedId: string | null;
	expectedAmountPaise: number;
	actualAmountPaise: number;
	differencePaise: number;
	status: string;
	notes: string | null;
	createdAt: string;
};

export default function ReconciliationPage() {
	const [kpis, setKpis] = useState<ReconciliationDashboardKPIs | null>(null);
	const [kpisLoading, setKpisLoading] = useState(true);

	const [settlements, setSettlements] = useState<SettlementRow[]>([]);
	const [settlementsLoading, setSettlementsLoading] = useState(false);

	const [codRows, setCodRows] = useState<CodRow[]>([]);
	const [codLoading, setCodLoading] = useState(false);

	const [records, setRecords] = useState<RecordRow[]>([]);
	const [recordsTotal, setRecordsTotal] = useState(0);
	const [recordsLoading, setRecordsLoading] = useState(false);
	const [recType, setRecType] = useState<string>("all");
	const [recStatus, setRecStatus] = useState<string>("all");

	const [importSettlementOpen, setImportSettlementOpen] = useState(false);
	const [importCodOpen, setImportCodOpen] = useState(false);
	const [importJson, setImportJson] = useState("");
	const [importBusy, setImportBusy] = useState(false);
	const [importError, setImportError] = useState<string | null>(null);

	const [manualOpen, setManualOpen] = useState(false);
	const [unmatchedRecords, setUnmatchedRecords] = useState<RecordRow[]>([]);
	const [manualRecordId, setManualRecordId] = useState("");
	const [manualMatchedId, setManualMatchedId] = useState("");
	const [manualNotes, setManualNotes] = useState("");
	const [manualBusy, setManualBusy] = useState(false);
	const [manualError, setManualError] = useState<string | null>(null);

	const [autoBusy, setAutoBusy] = useState(false);
	const [actionMsg, setActionMsg] = useState<string | null>(null);

	const loadKpis = useCallback(async () => {
		setKpisLoading(true);
		const res = await fetch("/api/v1/reconciliation/analytics");
		const json = await res.json();
		if (json.success) {
			setKpis(json.data as ReconciliationDashboardKPIs);
		} else {
			setKpis(null);
		}
		setKpisLoading(false);
	}, []);

	const loadSettlements = useCallback(async () => {
		setSettlementsLoading(true);
		const res = await fetch("/api/v1/reconciliation/settlements?pageSize=50");
		const json = await res.json();
		if (json.success) {
			setSettlements(json.data.items as SettlementRow[]);
		}
		setSettlementsLoading(false);
	}, []);

	const loadCod = useCallback(async () => {
		setCodLoading(true);
		const res = await fetch(
			"/api/v1/reconciliation/cod-remittances?pageSize=50",
		);
		const json = await res.json();
		if (json.success) {
			setCodRows(json.data.items as CodRow[]);
		}
		setCodLoading(false);
	}, []);

	const loadRecords = useCallback(async () => {
		setRecordsLoading(true);
		const p = new URLSearchParams({ page: "1", pageSize: "50" });
		if (recType !== "all") p.set("type", recType);
		if (recStatus !== "all") p.set("status", recStatus);
		const res = await fetch(`/api/v1/reconciliation/records?${p.toString()}`);
		const json = await res.json();
		if (json.success) {
			setRecords(json.data.items as RecordRow[]);
			setRecordsTotal(json.data.total as number);
		}
		setRecordsLoading(false);
	}, [recType, recStatus]);

	const loadUnmatchedForManual = useCallback(async () => {
		const res = await fetch(
			"/api/v1/reconciliation/records?status=UNMATCHED&pageSize=100&page=1",
		);
		const json = await res.json();
		if (json.success) {
			setUnmatchedRecords(json.data.items as RecordRow[]);
		}
	}, []);

	useEffect(() => {
		void loadKpis();
	}, [loadKpis]);

	useEffect(() => {
		void loadSettlements();
		void loadCod();
	}, [loadSettlements, loadCod]);

	useEffect(() => {
		void loadRecords();
	}, [loadRecords]);

	const refreshAll = useCallback(async () => {
		await Promise.all([
			loadKpis(),
			loadSettlements(),
			loadCod(),
			loadRecords(),
		]);
	}, [loadKpis, loadSettlements, loadCod, loadRecords]);

	const submitImport = async (kind: "settlement" | "cod") => {
		setImportError(null);
		let body: unknown;
		try {
			body = JSON.parse(importJson) as unknown;
		} catch {
			setImportError("Invalid JSON");
			return;
		}
		setImportBusy(true);
		const url =
			kind === "settlement"
				? "/api/v1/reconciliation/settlements"
				: "/api/v1/reconciliation/cod-remittances";
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const json = await res.json();
		setImportBusy(false);
		if (!json.success) {
			setImportError(json.error?.message ?? "Import failed");
			return;
		}
		setImportJson("");
		setImportSettlementOpen(false);
		setImportCodOpen(false);
		setActionMsg("Import queued for matching.");
		await refreshAll();
	};

	const submitManual = async () => {
		setManualError(null);
		if (!manualRecordId || !manualMatchedId.trim()) {
			setManualError("Record and matched ID are required.");
			return;
		}
		setManualBusy(true);
		const res = await fetch("/api/v1/reconciliation/match", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				recordId: manualRecordId,
				matchedId: manualMatchedId.trim(),
				notes: manualNotes.trim() || undefined,
			}),
		});
		const json = await res.json();
		setManualBusy(false);
		if (!json.success) {
			setManualError(json.error?.message ?? "Manual match failed");
			return;
		}
		setManualOpen(false);
		setManualRecordId("");
		setManualMatchedId("");
		setManualNotes("");
		setActionMsg("Manual match saved.");
		await refreshAll();
	};

	const runAutoReconcile = async () => {
		setAutoBusy(true);
		setActionMsg(null);
		const res = await fetch("/api/v1/reconciliation/auto-reconcile", {
			method: "POST",
		});
		const json = await res.json();
		setAutoBusy(false);
		if (!json.success) {
			setActionMsg(json.error?.message ?? "Auto-reconcile failed");
			return;
		}
		setActionMsg("Auto-reconcile job enqueued.");
	};

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<Link
						href="/finance"
						className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" aria-hidden />
						Finance
					</Link>
					<h1 className="text-2xl font-bold">Reconciliation</h1>
					<p className="text-sm text-muted-foreground">
						Gateway settlements and COD remittances vs payments and orders
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="secondary"
						disabled={autoBusy}
						onClick={() => void runAutoReconcile()}
					>
						{autoBusy ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
						) : (
							<GitMerge className="mr-2 h-4 w-4" aria-hidden />
						)}
						Auto reconcile
					</Button>
					<Button
						variant="outline"
						onClick={() => {
							void loadUnmatchedForManual();
							setManualError(null);
							setManualOpen(true);
						}}
					>
						Manual match
					</Button>
				</div>
			</div>

			{actionMsg ? (
				<p
					className={`flex items-center gap-2 text-sm ${actionMsg.includes("fail") ? "text-destructive" : "text-muted-foreground"}`}
				>
					{actionMsg.includes("fail") ? (
						<AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
					) : null}
					{actionMsg}
				</p>
			) : null}

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Total records</CardTitle>
						<BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{kpisLoading ? "—" : (kpis?.totalRecords ?? 0)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Match rate</CardTitle>
						<GitMerge className="h-4 w-4 text-muted-foreground" aria-hidden />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{kpisLoading
								? "—"
								: `${(kpis?.matchRate ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Unmatched</CardTitle>
						<AlertCircle className="h-4 w-4 text-amber-600" aria-hidden />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{kpisLoading ? "—" : (kpis?.unmatchedCount ?? 0)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Discrepancy</CardTitle>
						<AlertCircle className="h-4 w-4 text-red-600" aria-hidden />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{kpisLoading ? "—" : (kpis?.discrepancyCount ?? 0)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">
							Total difference
						</CardTitle>
						<IndianRupee
							className="h-4 w-4 text-muted-foreground"
							aria-hidden
						/>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{kpisLoading ? "—" : formatINR(kpis?.totalDifferencePaise ?? 0)}
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">By type</CardTitle>
				</CardHeader>
				<CardContent>
					{kpisLoading || !kpis ? (
						<p className="text-sm text-muted-foreground">Loading breakdown…</p>
					) : kpis.byType.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No reconciliation rows yet.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Type</TableHead>
									<TableHead className="text-right">Total</TableHead>
									<TableHead className="text-right">Matched</TableHead>
									<TableHead className="text-right">Unmatched</TableHead>
									<TableHead className="text-right">Discrepancy</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{kpis.byType.map((row) => (
									<TableRow key={row.type}>
										<TableCell className="font-medium">
											{typeLabel(row.type)}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{row.total}
										</TableCell>
										<TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
											{row.matched}
										</TableCell>
										<TableCell className="text-right tabular-nums text-amber-700 dark:text-amber-400">
											{row.unmatched}
										</TableCell>
										<TableCell className="text-right tabular-nums text-red-700 dark:text-red-400">
											{row.discrepancy}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Tabs defaultValue="settlements">
				<TabsList className="flex flex-wrap">
					<TabsTrigger value="settlements">Settlements</TabsTrigger>
					<TabsTrigger value="cod">COD remittances</TabsTrigger>
					<TabsTrigger value="records">Reconciliation records</TabsTrigger>
				</TabsList>

				<TabsContent value="settlements" className="space-y-4">
					<div className="flex justify-end">
						<Dialog
							open={importSettlementOpen}
							onOpenChange={setImportSettlementOpen}
						>
							<DialogTrigger asChild>
								<Button>
									<FileJson className="mr-2 h-4 w-4" aria-hidden />
									Import settlement
								</Button>
							</DialogTrigger>
							<DialogContent className="max-w-lg">
								<DialogHeader>
									<DialogTitle>Import settlement JSON</DialogTitle>
									<DialogDescription>
										Paste a body that matches ImportSettlementInput (gateway,
										settlementId, items with gatewayPaymentId, amounts, etc.).
									</DialogDescription>
								</DialogHeader>
								<textarea
									className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									value={importJson}
									onChange={(e) => setImportJson(e.target.value)}
									placeholder='{"gateway":"RAZORPAY","settlementId":"...", ...}'
								/>
								{importError ? (
									<p className="text-sm text-destructive">{importError}</p>
								) : null}
								<DialogFooter>
									<Button
										disabled={importBusy}
										onClick={() => void submitImport("settlement")}
									>
										{importBusy ? (
											<Loader2
												className="mr-2 h-4 w-4 animate-spin"
												aria-hidden
											/>
										) : null}
										Submit
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
					<Card>
						<CardContent className="pt-6">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Gateway</TableHead>
										<TableHead>Settlement ID</TableHead>
										<TableHead>Date</TableHead>
										<TableHead className="text-right">Amount</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">
											Matched / total
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{settlementsLoading ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center text-muted-foreground"
											>
												Loading…
											</TableCell>
										</TableRow>
									) : settlements.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center text-muted-foreground"
											>
												No settlements imported yet.
											</TableCell>
										</TableRow>
									) : (
										settlements.map((s) => (
											<TableRow key={s.id}>
												<TableCell>
													<span className="flex items-center gap-2">
														<CreditCard
															className="h-4 w-4 text-muted-foreground"
															aria-hidden
														/>
														{s.gateway}
													</span>
												</TableCell>
												<TableCell className="font-mono text-sm">
													{s.settlementId}
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{formatDate(s.settlementDate)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatINR(s.netAmountPaise)}
												</TableCell>
												<TableCell>
													<Badge variant="secondary">{s.status}</Badge>
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{s.matchedCount} / {s.itemCount}
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="cod" className="space-y-4">
					<div className="flex justify-end">
						<Dialog open={importCodOpen} onOpenChange={setImportCodOpen}>
							<DialogTrigger asChild>
								<Button>
									<FileJson className="mr-2 h-4 w-4" aria-hidden />
									Import COD remittance
								</Button>
							</DialogTrigger>
							<DialogContent className="max-w-lg">
								<DialogHeader>
									<DialogTitle>Import COD remittance JSON</DialogTitle>
									<DialogDescription>
										Paste a body that matches ImportCodRemittanceInput (carrier,
										remittanceId, items with awbNumber, amounts).
									</DialogDescription>
								</DialogHeader>
								<textarea
									className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									value={importJson}
									onChange={(e) => setImportJson(e.target.value)}
								/>
								{importError ? (
									<p className="text-sm text-destructive">{importError}</p>
								) : null}
								<DialogFooter>
									<Button
										disabled={importBusy}
										onClick={() => void submitImport("cod")}
									>
										{importBusy ? (
											<Loader2
												className="mr-2 h-4 w-4 animate-spin"
												aria-hidden
											/>
										) : null}
										Submit
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
					<Card>
						<CardContent className="pt-6">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Carrier</TableHead>
										<TableHead>Remittance ID</TableHead>
										<TableHead>Date</TableHead>
										<TableHead className="text-right">Net</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">
											Matched / total
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{codLoading ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center text-muted-foreground"
											>
												Loading…
											</TableCell>
										</TableRow>
									) : codRows.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center text-muted-foreground"
											>
												No COD remittances yet.
											</TableCell>
										</TableRow>
									) : (
										codRows.map((r) => (
											<TableRow key={r.id}>
												<TableCell>
													<span className="flex items-center gap-2">
														<Truck
															className="h-4 w-4 text-muted-foreground"
															aria-hidden
														/>
														{r.carrier}
													</span>
												</TableCell>
												<TableCell className="font-mono text-sm">
													{r.remittanceId}
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{formatDate(r.remittanceDate)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatINR(r.netAmountPaise)}
												</TableCell>
												<TableCell>
													<Badge variant="secondary">{r.status}</Badge>
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{r.matchedCount} / {r.itemCount}
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="records" className="space-y-4">
					<div className="flex flex-wrap items-end gap-4">
						<div className="space-y-2">
							<Label>Type</Label>
							<Select value={recType} onValueChange={setRecType}>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="All types" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All types</SelectItem>
									<SelectItem value="PAYMENT_GATEWAY">
										Payment Gateway
									</SelectItem>
									<SelectItem value="COD_CARRIER">COD Carrier</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Status</Label>
							<Select value={recStatus} onValueChange={setRecStatus}>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="All statuses" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All statuses</SelectItem>
									<SelectItem value="MATCHED">Matched</SelectItem>
									<SelectItem value="UNMATCHED">Unmatched</SelectItem>
									<SelectItem value="DISCREPANCY">Discrepancy</SelectItem>
									<SelectItem value="MANUAL_OVERRIDE">Manual</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<p className="pb-2 text-sm text-muted-foreground">
							{recordsTotal} total
						</p>
					</div>
					<Card>
						<CardContent className="pt-6">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Type</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">Expected</TableHead>
										<TableHead className="text-right">Actual</TableHead>
										<TableHead className="text-right">Difference</TableHead>
										<TableHead>Reference</TableHead>
										<TableHead>Created</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{recordsLoading ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="text-center text-muted-foreground"
											>
												Loading…
											</TableCell>
										</TableRow>
									) : records.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="text-center text-muted-foreground"
											>
												No records for this filter.
											</TableCell>
										</TableRow>
									) : (
										records.map((r) => (
											<TableRow key={r.id}>
												<TableCell>{typeLabel(r.type)}</TableCell>
												<TableCell>{statusBadge(r.status)}</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatINR(r.expectedAmountPaise)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatINR(r.actualAmountPaise)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatINR(r.differencePaise)}
												</TableCell>
												<TableCell className="max-w-[140px] truncate font-mono text-xs">
													{r.referenceId}
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{formatDate(r.createdAt)}
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Dialog open={manualOpen} onOpenChange={setManualOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Manual match</DialogTitle>
						<DialogDescription>
							Link an unmatched reconciliation row to a payment ID (gateway) or
							order ID (COD).
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>Record</Label>
							<Select value={manualRecordId} onValueChange={setManualRecordId}>
								<SelectTrigger>
									<SelectValue placeholder="Choose unmatched record" />
								</SelectTrigger>
								<SelectContent>
									{unmatchedRecords.map((r) => (
										<SelectItem key={r.id} value={r.id}>
											{typeLabel(r.type)} · {formatINR(r.expectedAmountPaise)} ·{" "}
											{r.referenceId.slice(0, 8)}…
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="matched-id">Matched payment or order ID</Label>
							<Input
								id="matched-id"
								value={manualMatchedId}
								onChange={(e) => setManualMatchedId(e.target.value)}
								placeholder="cuid…"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="notes">Notes (optional)</Label>
							<Input
								id="notes"
								value={manualNotes}
								onChange={(e) => setManualNotes(e.target.value)}
							/>
						</div>
						{manualError ? (
							<p className="text-sm text-destructive">{manualError}</p>
						) : null}
					</div>
					<DialogFooter>
						<Button disabled={manualBusy} onClick={() => void submitManual()}>
							{manualBusy ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
							) : null}
							Save match
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
