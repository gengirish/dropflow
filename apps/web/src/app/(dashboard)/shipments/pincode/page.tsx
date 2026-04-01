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
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { DEFAULT_PINCODE_CHECK_WEIGHT_GRAMS } from "@/lib/pincode-rate-engine";
import { CARRIERS } from "@dropflow/config";
import { Loader2, MapPin, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const CARRIER_KEYS = Object.keys(CARRIERS) as (keyof typeof CARRIERS)[];

type CarrierOptionRow = {
	carrier: string;
	carrierDisplayName: string;
	isServiceable: boolean;
	isCodAvailable: boolean;
	estimatedDays: number | null;
	ratePaise: number | null;
	codChargePaise: number;
	totalPaise: number | null;
	zone: string | null;
};

type CheckResult = {
	pincode: string;
	isServiceable: boolean;
	isCodAvailable: boolean;
	carriers: CarrierOptionRow[];
	cheapestCarrier: CarrierOptionRow | null;
	fastestCarrier: CarrierOptionRow | null;
	deliverability: {
		deliveryRate: number;
		avgDeliveryDays: number;
		totalShipments: number;
	} | null;
};

type RateRow = {
	id: string;
	carrier: string;
	zone: string;
	minWeightGrams: number;
	maxWeightGrams: number;
	basePricePaise: number;
	additionalPerGramPaise: number;
	codChargePaise: number;
	fuelSurchargePercent: number;
	validFrom: string;
	validTo: string | null;
	isActive: boolean;
};

function formatInrPaise(paise: number | null): string {
	if (paise === null) return "—";
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 2,
	}).format(paise / 100);
}

function rupeesToPaise(rupees: string): number {
	const n = Number.parseFloat(rupees.replace(/,/g, ""));
	if (Number.isNaN(n)) return 0;
	return Math.round(n * 100);
}

function paiseToRupeesInput(paise: number): string {
	return (paise / 100).toFixed(2);
}

const emptyRateForm = {
	carrier: "SHIPROCKET" as keyof typeof CARRIERS,
	zone: "",
	minWeightGrams: "0",
	maxWeightGrams: "500",
	baseRupees: "0",
	additionalPerGramPaise: "0",
	codRupees: "0",
	fuelSurchargePercent: "0",
	validFrom: new Date().toISOString().slice(0, 10),
	validTo: "",
};

export default function PincodeServiceabilityPage() {
	const [pincode, setPincode] = useState("");
	const [weightGrams, setWeightGrams] = useState("");
	const [isCod, setIsCod] = useState(false);
	const [checkLoading, setCheckLoading] = useState(false);
	const [checkError, setCheckError] = useState<string | null>(null);
	const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

	const [rates, setRates] = useState<RateRow[]>([]);
	const [ratesLoading, setRatesLoading] = useState(true);
	const [rateDialogOpen, setRateDialogOpen] = useState(false);
	const [editingRateId, setEditingRateId] = useState<string | null>(null);
	const [rateSaving, setRateSaving] = useState(false);
	const [rateForm, setRateForm] = useState(emptyRateForm);

	const fetchRates = useCallback(async () => {
		setRatesLoading(true);
		try {
			const res = await fetch("/api/v1/pincode/rates?pageSize=100");
			const json = await res.json();
			if (json.success && json.data?.items) {
				setRates(json.data.items as RateRow[]);
			} else {
				setRates([]);
			}
		} finally {
			setRatesLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchRates();
	}, [fetchRates]);

	const openNewRate = () => {
		setEditingRateId(null);
		setRateForm(emptyRateForm);
		setRateDialogOpen(true);
	};

	const openEditRate = (r: RateRow) => {
		setEditingRateId(r.id);
		setRateForm({
			carrier: r.carrier as keyof typeof CARRIERS,
			zone: r.zone,
			minWeightGrams: String(r.minWeightGrams),
			maxWeightGrams: String(r.maxWeightGrams),
			baseRupees: paiseToRupeesInput(r.basePricePaise),
			additionalPerGramPaise: String(r.additionalPerGramPaise),
			codRupees: paiseToRupeesInput(r.codChargePaise),
			fuelSurchargePercent: String(r.fuelSurchargePercent),
			validFrom: r.validFrom.slice(0, 10),
			validTo: r.validTo ? r.validTo.slice(0, 10) : "",
		});
		setRateDialogOpen(true);
	};

	const submitCheck = async (e: React.FormEvent) => {
		e.preventDefault();
		setCheckError(null);
		setCheckLoading(true);
		try {
			const body: Record<string, unknown> = {
				pincode: pincode.trim(),
				isCod,
			};
			const w = weightGrams.trim();
			if (w) body.weightGrams = Number.parseInt(w, 10);

			const res = await fetch("/api/v1/pincode/check", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const json = await res.json();
			if (!json.success) {
				setCheckError(json.error?.message ?? "Check failed");
				setCheckResult(null);
				return;
			}
			setCheckResult(json.data as CheckResult);
		} catch {
			setCheckError("Network error");
			setCheckResult(null);
		} finally {
			setCheckLoading(false);
		}
	};

	const submitRate = async (e: React.FormEvent) => {
		e.preventDefault();
		setRateSaving(true);
		try {
			const validFromIso = new Date(
				`${rateForm.validFrom}T00:00:00.000Z`,
			).toISOString();
			const validToIso = rateForm.validTo.trim()
				? new Date(`${rateForm.validTo}T23:59:59.999Z`).toISOString()
				: undefined;

			const basePayload = {
				carrier: rateForm.carrier,
				zone: rateForm.zone.trim(),
				minWeightGrams: Number.parseInt(rateForm.minWeightGrams, 10),
				maxWeightGrams: Number.parseInt(rateForm.maxWeightGrams, 10),
				basePricePaise: rupeesToPaise(rateForm.baseRupees),
				additionalPerGramPaise: Number.parseFloat(
					rateForm.additionalPerGramPaise || "0",
				),
				codChargePaise: rupeesToPaise(rateForm.codRupees),
				fuelSurchargePercent: Number.parseFloat(
					rateForm.fuelSurchargePercent || "0",
				),
				validFrom: validFromIso,
			};

			const payload = editingRateId
				? {
						...basePayload,
						validTo: validToIso ?? null,
					}
				: {
						...basePayload,
						...(validToIso ? { validTo: validToIso } : {}),
					};

			const url = editingRateId
				? `/api/v1/pincode/rates/${editingRateId}`
				: "/api/v1/pincode/rates";
			const res = await fetch(url, {
				method: editingRateId ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const json = await res.json();
			if (!json.success) {
				alert(json.error?.message ?? "Save failed");
				return;
			}
			setRateDialogOpen(false);
			await fetchRates();
		} finally {
			setRateSaving(false);
		}
	};

	const deleteRate = async (id: string) => {
		if (!confirm("Delete this carrier rate?")) return;
		const res = await fetch(`/api/v1/pincode/rates/${id}`, {
			method: "DELETE",
		});
		const json = await res.json();
		if (!json.success) {
			alert(json.error?.message ?? "Delete failed");
			return;
		}
		await fetchRates();
	};

	const rowHighlight = (row: CarrierOptionRow) => {
		const cheap = checkResult?.cheapestCarrier;
		const fast = checkResult?.fastestCarrier;
		const isCheap =
			Boolean(cheap) &&
			row.carrier === cheap?.carrier &&
			row.zone === cheap?.zone &&
			row.totalPaise === cheap?.totalPaise;
		const isFast =
			Boolean(fast) &&
			row.carrier === fast?.carrier &&
			row.estimatedDays === fast?.estimatedDays;
		return { isCheap, isFast };
	};

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Pincode serviceability
				</h1>
				<p className="text-muted-foreground text-sm mt-1">
					Check delivery coverage and tenant carrier rates by zone and weight.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<MapPin className="h-5 w-5" aria-hidden />
						Pincode checker
					</CardTitle>
					<CardDescription>
						Uses serviceability data, your carrier rate slabs, and historical
						delivery stats. Weight defaults to{" "}
						{DEFAULT_PINCODE_CHECK_WEIGHT_GRAMS}g when omitted.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<form
						onSubmit={submitCheck}
						className="flex flex-wrap gap-4 items-end"
					>
						<div className="space-y-2">
							<Label htmlFor="pincode">PIN code</Label>
							<Input
								id="pincode"
								className="w-40 font-mono"
								placeholder="560001"
								maxLength={6}
								value={pincode}
								onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="weight">Weight (g)</Label>
							<Input
								id="weight"
								className="w-28"
								placeholder={`${DEFAULT_PINCODE_CHECK_WEIGHT_GRAMS}`}
								inputMode="numeric"
								value={weightGrams}
								onChange={(e) =>
									setWeightGrams(e.target.value.replace(/\D/g, ""))
								}
							/>
						</div>
						<label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
							<input
								type="checkbox"
								checked={isCod}
								onChange={(e) => setIsCod(e.target.checked)}
								className="rounded border-input"
							/>
							Include COD in total
						</label>
						<Button
							type="submit"
							disabled={pincode.length !== 6 || checkLoading}
						>
							{checkLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Check"
							)}
						</Button>
					</form>

					{checkError ? (
						<p className="text-sm text-destructive">{checkError}</p>
					) : null}

					{checkResult?.deliverability ? (
						<div className="rounded-lg border bg-muted/30 p-4 grid gap-2 sm:grid-cols-3 text-sm">
							<div>
								<p className="text-muted-foreground">
									Historical delivery rate
								</p>
								<p className="text-lg font-semibold">
									{(checkResult.deliverability.deliveryRate * 100).toFixed(1)}%
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Avg. delivery days</p>
								<p className="text-lg font-semibold">
									{checkResult.deliverability.avgDeliveryDays.toFixed(1)}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Shipments in aggregate</p>
								<p className="text-lg font-semibold">
									{checkResult.deliverability.totalShipments}
								</p>
							</div>
						</div>
					) : checkResult ? (
						<p className="text-sm text-muted-foreground">
							No aggregate delivery stats for this PIN yet.
						</p>
					) : null}

					{checkResult ? (
						<div className="rounded-md border overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Carrier</TableHead>
										<TableHead>Zone</TableHead>
										<TableHead>Serviceable</TableHead>
										<TableHead>COD</TableHead>
										<TableHead>Est. days</TableHead>
										<TableHead className="text-right">Shipping</TableHead>
										<TableHead className="text-right">COD fee</TableHead>
										<TableHead className="text-right">Total</TableHead>
										<TableHead>Highlights</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{checkResult.carriers.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={9}
												className="text-center text-muted-foreground py-8"
											>
												No serviceability rows for this PIN. Seed data via the
												serviceability API.
											</TableCell>
										</TableRow>
									) : (
										checkResult.carriers.map((row) => {
											const { isCheap, isFast } = rowHighlight(row);
											return (
												<TableRow
													key={`${row.carrier}-${row.zone}`}
													className={
														isCheap || isFast ? "bg-primary/5" : undefined
													}
												>
													<TableCell className="font-medium">
														{row.carrierDisplayName}
													</TableCell>
													<TableCell className="font-mono text-sm">
														{row.zone ?? "—"}
													</TableCell>
													<TableCell>
														{row.isServiceable ? (
															<Badge variant="secondary">Yes</Badge>
														) : (
															<Badge variant="outline">No</Badge>
														)}
													</TableCell>
													<TableCell>
														{row.isCodAvailable ? (
															<Badge variant="secondary">Yes</Badge>
														) : (
															<Badge variant="outline">No</Badge>
														)}
													</TableCell>
													<TableCell>{row.estimatedDays ?? "—"}</TableCell>
													<TableCell className="text-right tabular-nums">
														{formatInrPaise(row.ratePaise)}
													</TableCell>
													<TableCell className="text-right tabular-nums">
														{formatInrPaise(
															row.isCodAvailable ? row.codChargePaise : 0,
														)}
													</TableCell>
													<TableCell className="text-right font-medium tabular-nums">
														{formatInrPaise(row.totalPaise)}
													</TableCell>
													<TableCell className="gap-1 flex flex-wrap">
														{isCheap ? (
															<Badge className="gap-1">Cheapest</Badge>
														) : null}
														{isFast ? (
															<Badge variant="outline" className="gap-1">
																<Zap className="h-3 w-3" />
																Fastest
															</Badge>
														) : null}
													</TableCell>
												</TableRow>
											);
										})
									)}
								</TableBody>
							</Table>
						</div>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0">
					<div>
						<CardTitle className="text-lg">Carrier rates</CardTitle>
						<CardDescription>
							Tenant-specific slabs: zone, weight range, base price, COD charge.
						</CardDescription>
					</div>
					<Button size="sm" onClick={openNewRate}>
						<Plus className="h-4 w-4 mr-1" />
						Add rate
					</Button>
				</CardHeader>
				<CardContent>
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Carrier</TableHead>
									<TableHead>Zone</TableHead>
									<TableHead>Weight (g)</TableHead>
									<TableHead className="text-right">Base</TableHead>
									<TableHead className="text-right">COD</TableHead>
									<TableHead className="text-right">Fuel %</TableHead>
									<TableHead>Valid from</TableHead>
									<TableHead className="w-[100px]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{ratesLoading ? (
									<TableRow>
										<TableCell colSpan={8} className="text-center py-8">
											<Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
										</TableCell>
									</TableRow>
								) : rates.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={8}
											className="text-center py-8 text-muted-foreground"
										>
											No rates yet. Add a slab that matches serviceability
											zones.
										</TableCell>
									</TableRow>
								) : (
									rates.map((r) => (
										<TableRow key={r.id}>
											<TableCell>
												{CARRIERS[r.carrier as keyof typeof CARRIERS]
													?.displayName ?? r.carrier}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{r.zone}
											</TableCell>
											<TableCell className="text-sm tabular-nums">
												{r.minWeightGrams}–{r.maxWeightGrams}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatInrPaise(r.basePricePaise)}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatInrPaise(r.codChargePaise)}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{r.fuelSurchargePercent}%
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{new Date(r.validFrom).toLocaleDateString("en-IN")}
											</TableCell>
											<TableCell>
												<div className="flex gap-1 justify-end">
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() => openEditRate(r)}
														aria-label="Edit rate"
													>
														<Pencil className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-destructive"
														onClick={() => deleteRate(r.id)}
														aria-label="Delete rate"
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
					</div>
				</CardContent>
			</Card>

			<Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
				<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingRateId ? "Edit carrier rate" : "Add carrier rate"}
						</DialogTitle>
						<DialogDescription>
							Slab must cover weight in grams. Zone should match pincode
							serviceability rows.
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={submitRate} className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="rf-carrier">Carrier</Label>
							<select
								id="rf-carrier"
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								value={rateForm.carrier}
								onChange={(e) =>
									setRateForm((f) => ({
										...f,
										carrier: e.target.value as keyof typeof CARRIERS,
									}))
								}
							>
								{CARRIER_KEYS.map((k) => (
									<option key={k} value={k}>
										{CARRIERS[k].displayName}
									</option>
								))}
							</select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="rf-zone">Zone</Label>
							<Input
								id="rf-zone"
								value={rateForm.zone}
								onChange={(e) =>
									setRateForm((f) => ({ ...f, zone: e.target.value }))
								}
								placeholder="A"
								required
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="rf-minw">Min weight (g)</Label>
								<Input
									id="rf-minw"
									inputMode="numeric"
									value={rateForm.minWeightGrams}
									onChange={(e) =>
										setRateForm((f) => ({
											...f,
											minWeightGrams: e.target.value,
										}))
									}
									required
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="rf-maxw">Max weight (g)</Label>
								<Input
									id="rf-maxw"
									inputMode="numeric"
									value={rateForm.maxWeightGrams}
									onChange={(e) =>
										setRateForm((f) => ({
											...f,
											maxWeightGrams: e.target.value,
										}))
									}
									required
								/>
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="rf-base">Base price (₹)</Label>
							<Input
								id="rf-base"
								inputMode="decimal"
								value={rateForm.baseRupees}
								onChange={(e) =>
									setRateForm((f) => ({ ...f, baseRupees: e.target.value }))
								}
								required
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="rf-add">Additional per gram (paise)</Label>
							<Input
								id="rf-add"
								inputMode="decimal"
								value={rateForm.additionalPerGramPaise}
								onChange={(e) =>
									setRateForm((f) => ({
										...f,
										additionalPerGramPaise: e.target.value,
									}))
								}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="rf-cod">COD charge (₹)</Label>
							<Input
								id="rf-cod"
								inputMode="decimal"
								value={rateForm.codRupees}
								onChange={(e) =>
									setRateForm((f) => ({ ...f, codRupees: e.target.value }))
								}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="rf-fuel">Fuel surcharge %</Label>
							<Input
								id="rf-fuel"
								inputMode="decimal"
								value={rateForm.fuelSurchargePercent}
								onChange={(e) =>
									setRateForm((f) => ({
										...f,
										fuelSurchargePercent: e.target.value,
									}))
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="rf-vf">Valid from</Label>
								<Input
									id="rf-vf"
									type="date"
									value={rateForm.validFrom}
									onChange={(e) =>
										setRateForm((f) => ({ ...f, validFrom: e.target.value }))
									}
									required
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="rf-vt">Valid to (optional)</Label>
								<Input
									id="rf-vt"
									type="date"
									value={rateForm.validTo}
									onChange={(e) =>
										setRateForm((f) => ({ ...f, validTo: e.target.value }))
									}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setRateDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={rateSaving}>
								{rateSaving ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									"Save"
								)}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
