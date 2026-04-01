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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ReturnDetail = {
	id: string;
	returnNumber: string;
	status: string;
	reason: string;
	customerNotes: string | null;
	returnAwbNumber: string | null;
	returnCarrier: string | null;
	qcNotes: string | null;
	qcPassedAt: string | null;
	qcFailedAt: string | null;
	createdAt: string;
	updatedAt: string;
	order: {
		id: string;
		orderNumber: string;
		buyerName: string;
		buyerEmail: string;
		buyerPhone: string;
		status: string;
		totalPaise: number;
	};
	items: {
		id: string;
		quantity: number;
		reason: string;
		condition: string;
		restocked: boolean;
		product: { id: string; name: string; sku: string } | null;
	}[];
	refund: {
		id: string;
		status: string;
		method: string;
		amountPaise: number;
		processedAt: string | null;
		createdAt: string;
	} | null;
};

function unwrapData<T>(json: unknown): T | null {
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

export default function ReturnDetailPage() {
	const params = useParams();
	const router = useRouter();
	const id = typeof params.id === "string" ? params.id : "";

	const [detail, setDetail] = useState<ReturnDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [qcNotes, setQcNotes] = useState("");
	const [refundMethod, setRefundMethod] = useState<
		"ORIGINAL_PAYMENT" | "STORE_CREDIT" | "BANK_TRANSFER"
	>("ORIGINAL_PAYMENT");
	const [amountPaise, setAmountPaise] = useState("");
	const [pickupOpen, setPickupOpen] = useState(false);
	const [awb, setAwb] = useState("");
	const [carrier, setCarrier] = useState("");

	const load = useCallback(async () => {
		if (!id) return;
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/v1/returns/${id}`);
			const json = await res.json();
			const d = unwrapData<ReturnDetail>(json);
			if (!d) {
				setError("Return not found");
				setDetail(null);
				return;
			}
			setDetail(d);
			setQcNotes(d.qcNotes ?? "");
			if (d.order?.totalPaise) {
				setAmountPaise(String(d.order.totalPaise));
			}
		} catch {
			setError("Failed to load return");
		} finally {
			setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		void load();
	}, [load]);

	const timeline = useMemo(() => {
		if (!detail) return [];
		const s = detail.status;
		const rejected = s === "REJECTED";
		const postPickup = [
			"PICKUP_SCHEDULED",
			"PICKED_UP",
			"RECEIVED",
			"QC_PASSED",
			"QC_FAILED",
			"REFUND_INITIATED",
			"REFUND_COMPLETED",
		] as const;
		const postPicked = [
			"PICKED_UP",
			"RECEIVED",
			"QC_PASSED",
			"QC_FAILED",
			"REFUND_INITIATED",
			"REFUND_COMPLETED",
		] as const;
		const postReceived = [
			"RECEIVED",
			"QC_PASSED",
			"QC_FAILED",
			"REFUND_INITIATED",
			"REFUND_COMPLETED",
		] as const;
		const postQc = [
			"QC_PASSED",
			"QC_FAILED",
			"REFUND_INITIATED",
			"REFUND_COMPLETED",
		] as const;

		const steps: {
			label: string;
			done: boolean;
			note?: string;
			at?: string;
		}[] = [
			{ label: "Request submitted", done: true, at: detail.createdAt },
			{
				label: rejected
					? "Rejected (outside window or policy)"
					: "Approved for return",
				done: s !== "REQUESTED",
				at: s !== "REQUESTED" ? detail.updatedAt : undefined,
				note: rejected ? "Return not accepted" : undefined,
			},
			{
				label: "Pickup scheduled",
				done:
					!rejected && postPickup.includes(s as (typeof postPickup)[number]),
				note: detail.returnAwbNumber
					? `AWB ${detail.returnAwbNumber}${detail.returnCarrier ? ` · ${detail.returnCarrier}` : ""}`
					: undefined,
			},
			{
				label: "In transit / picked up",
				done:
					!rejected && postPicked.includes(s as (typeof postPicked)[number]),
			},
			{
				label: "Received at warehouse",
				done:
					!rejected &&
					postReceived.includes(s as (typeof postReceived)[number]),
			},
			{
				label: "Quality check",
				done: !rejected && postQc.includes(s as (typeof postQc)[number]),
				note:
					s === "QC_PASSED"
						? "Passed — inventory restocked"
						: s === "QC_FAILED"
							? "Failed"
							: (detail.qcNotes ?? undefined),
				at: detail.qcPassedAt ?? detail.qcFailedAt ?? undefined,
			},
			{
				label: "Refund",
				done: !rejected && s === "REFUND_COMPLETED",
				note: detail.refund
					? `${detail.refund.method} · ${formatINRFromPaise(detail.refund.amountPaise)} (${detail.refund.status})`
					: undefined,
				at: detail.refund?.processedAt ?? detail.refund?.createdAt,
			},
		];
		return steps;
	}, [detail]);

	const nextAction = useMemo(() => {
		if (!detail) return null;
		switch (detail.status) {
			case "REQUESTED":
				return { label: "Submit for approval", action: "approve" as const };
			case "APPROVED":
				return { label: "Schedule pickup", action: "pickup" as const };
			case "PICKUP_SCHEDULED":
				return { label: "Mark picked up", action: "picked_up" as const };
			case "PICKED_UP":
				return { label: "Mark received", action: "received" as const };
			case "RECEIVED":
				return { label: "Run QC (below)", action: "qc_focus" as const };
			case "QC_PASSED":
				return {
					label: "Initiate refund (below)",
					action: "refund_focus" as const,
				};
			default:
				return null;
		}
	}, [detail]);

	async function patch(body: object) {
		const res = await fetch(`/api/v1/returns/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const json = await res.json();
		if (!json.success) {
			throw new Error(json?.error?.message ?? "Request failed");
		}
		if (res.status === 202) {
			await new Promise((r) => setTimeout(r, 900));
		}
		await load();
	}

	async function postRefund() {
		const amt = Number(amountPaise);
		if (!Number.isFinite(amt) || amt <= 0) {
			setError("Enter a valid amount in paise");
			return;
		}
		const res = await fetch(`/api/v1/returns/${id}/refund`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				returnRequestId: id,
				method: refundMethod,
				amountPaise: amt,
			}),
		});
		const json = await res.json();
		if (!json.success) {
			setError(json?.error?.message ?? "Refund failed");
			return;
		}
		await new Promise((r) => setTimeout(r, 900));
		await load();
	}

	async function runNextAction() {
		if (!nextAction) return;
		setError(null);
		try {
			switch (nextAction.action) {
				case "approve":
					await patch({ status: "APPROVED" });
					break;
				case "pickup":
					setAwb(detail?.returnAwbNumber ?? "");
					setCarrier(detail?.returnCarrier ?? "");
					setPickupOpen(true);
					break;
				case "picked_up":
					await patch({ status: "PICKED_UP" });
					break;
				case "received":
					await patch({ status: "RECEIVED" });
					break;
				case "refund_focus":
					document
						.getElementById("return-refund")
						?.scrollIntoView({ behavior: "smooth", block: "start" });
					break;
				case "qc_focus":
					document
						.getElementById("return-qc")
						?.scrollIntoView({ behavior: "smooth", block: "start" });
					break;
				default:
					break;
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed");
		}
	}

	async function submitPickupDialog() {
		setError(null);
		try {
			await patch({
				status: "PICKUP_SCHEDULED",
				returnAwbNumber: awb || undefined,
				returnCarrier: carrier || undefined,
			});
			setPickupOpen(false);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed");
		}
	}

	if (loading && !detail) {
		return <div className="text-sm text-muted-foreground">Loading return…</div>;
	}

	if (!detail) {
		return (
			<div className="space-y-4">
				<p className="text-destructive">{error ?? "Not found"}</p>
				<Button variant="outline" size="sm" asChild>
					<Link href="/returns">Back to returns</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl space-y-8">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
						<Link href="/returns">
							<ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
							All returns
						</Link>
					</Button>
					<h1 className="text-2xl font-semibold tracking-tight">
						{detail.returnNumber}
					</h1>
					<p className="text-sm text-muted-foreground">
						Order{" "}
						<button
							type="button"
							className="text-primary underline-offset-4 hover:underline"
							onClick={() => router.push(`/orders/${detail.order.id}`)}
						>
							{detail.order.orderNumber}
						</button>
					</p>
				</div>
				<div className="flex flex-col items-end gap-2">
					<Badge
						variant={statusBadgeVariant(detail.status)}
						className="text-sm"
					>
						{detail.status.replace(/_/g, " ")}
					</Badge>
					{nextAction ? (
						<Button size="sm" onClick={() => void runNextAction()}>
							{nextAction.label}
						</Button>
					) : null}
				</div>
			</div>

			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}

			<div className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Order</CardTitle>
						<CardDescription>Customer and totals</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<p>
							<span className="text-muted-foreground">Buyer</span>{" "}
							{detail.order.buyerName}
						</p>
						<p>
							<span className="text-muted-foreground">Email</span>{" "}
							{detail.order.buyerEmail}
						</p>
						<p>
							<span className="text-muted-foreground">Phone</span>{" "}
							{detail.order.buyerPhone}
						</p>
						<Separator className="my-2" />
						<p>
							<span className="text-muted-foreground">Order status</span>{" "}
							<Badge variant="outline">{detail.order.status}</Badge>
						</p>
						<p>
							<span className="text-muted-foreground">Order total</span>{" "}
							{formatINRFromPaise(detail.order.totalPaise)}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Return reason</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<p className="font-medium">{detail.reason.replace(/_/g, " ")}</p>
						<p className="text-muted-foreground">
							{detail.customerNotes?.trim()
								? detail.customerNotes
								: "No customer notes."}
						</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Items</CardTitle>
					<CardDescription>Quantities and condition</CardDescription>
				</CardHeader>
				<CardContent>
					<ul className="divide-y rounded-md border">
						{detail.items.map((it) => (
							<li
								key={it.id}
								className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
							>
								<div>
									<p className="font-medium">
										{it.product?.name ?? "Product"}
										<span className="ml-2 text-muted-foreground">
											({it.product?.sku ?? it.product?.id ?? "—"})
										</span>
									</p>
									<p className="text-muted-foreground">
										Qty {it.quantity} · line reason{" "}
										{it.reason.replace(/_/g, " ")} · condition {it.condition}
										{it.restocked ? " · restocked" : ""}
									</p>
								</div>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Status timeline</CardTitle>
					<CardDescription>
						Progress through the return workflow
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ol className="space-y-4">
						{timeline.map((step) => (
							<li key={step.label} className="flex gap-3 text-sm">
								<div className="mt-0.5 shrink-0">
									{step.done ? (
										<CheckCircle2
											className="h-5 w-5 text-primary"
											aria-hidden
										/>
									) : (
										<Circle
											className="h-5 w-5 text-muted-foreground"
											aria-hidden
										/>
									)}
								</div>
								<div>
									<p className="font-medium">{step.label}</p>
									{step.note ? (
										<p className="text-muted-foreground">{step.note}</p>
									) : null}
									{step.at ? (
										<p className="text-xs text-muted-foreground">
											{new Date(step.at).toLocaleString()}
										</p>
									) : null}
								</div>
							</li>
						))}
					</ol>
				</CardContent>
			</Card>

			{detail.status === "RECEIVED" ? (
				<Card id="return-qc">
					<CardHeader>
						<CardTitle className="text-base">Quality check</CardTitle>
						<CardDescription>Record outcome and notes</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-2">
							<Label htmlFor="qc-notes">QC notes</Label>
							<Textarea
								id="qc-notes"
								value={qcNotes}
								onChange={(e) => setQcNotes(e.target.value)}
								rows={3}
							/>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								onClick={() =>
									void patch({
										status: "QC_PASSED",
										qcNotes: qcNotes || undefined,
									}).catch((e: Error) => setError(e.message))
								}
							>
								Mark QC passed
							</Button>
							<Button
								type="button"
								variant="destructive"
								onClick={() =>
									void patch({
										status: "QC_FAILED",
										qcNotes: qcNotes || undefined,
									}).catch((e: Error) => setError(e.message))
								}
							>
								Mark QC failed
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}

			{detail.status === "QC_PASSED" ? (
				<Card id="return-refund">
					<CardHeader>
						<CardTitle className="text-base">Refund</CardTitle>
						<CardDescription>
							Amount is in paise (e.g. order total {detail.order.totalPaise}{" "}
							paise).
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-2 sm:max-w-xs">
							<Label>Method</Label>
							<Select
								value={refundMethod}
								onValueChange={(v) => setRefundMethod(v as typeof refundMethod)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ORIGINAL_PAYMENT">
										Original payment
									</SelectItem>
									<SelectItem value="STORE_CREDIT">Store credit</SelectItem>
									<SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2 sm:max-w-xs">
							<Label htmlFor="amt">Amount (paise)</Label>
							<Input
								id="amt"
								inputMode="numeric"
								value={amountPaise}
								onChange={(e) => setAmountPaise(e.target.value)}
							/>
						</div>
						<Button type="button" onClick={() => void postRefund()}>
							Initiate refund
						</Button>
					</CardContent>
				</Card>
			) : null}

			<Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Schedule pickup</DialogTitle>
					</DialogHeader>
					<div className="grid gap-3 py-2">
						<div className="grid gap-2">
							<Label htmlFor="d-awb">Return AWB (optional)</Label>
							<Input
								id="d-awb"
								value={awb}
								onChange={(e) => setAwb(e.target.value)}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="d-carrier">Carrier (optional)</Label>
							<Input
								id="d-carrier"
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
						<Button type="button" onClick={() => void submitPickupDialog()}>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
