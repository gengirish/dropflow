"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateIST, formatPaiseINR } from "@/lib/utils";
import {
	ArrowLeft,
	CheckCircle2,
	Circle,
	Loader2,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";

interface OrderDetail {
	id: string;
	orderNumber: string;
	buyerName: string;
	buyerEmail: string;
	buyerPhone: string;
	shippingAddress: { line1: string; city: string; state: string; pin: string };
	status: string;
	subtotalPaise: number;
	taxPaise: number;
	totalPaise: number;
	createdAt: string;
	items: Array<{
		id: string;
		quantity: number;
		unitPricePaise: number;
		totalPaise: number;
		hsnCode: string;
		product: { name: string; sku: string };
	}>;
	statusHistory: Array<{
		id: string;
		status: string;
		note: string | null;
		createdAt: string;
	}>;
	workflowRun: {
		id: string;
		status: string;
		currentStep: string | null;
		auditLog: Array<{
			step: string;
			status: string;
			timestamp: string;
			data?: Record<string, unknown>;
			error?: string;
		}>;
		workflowDef: {
			name: string;
			dagJson: {
				nodes: Array<{ id: string; label: string; dependsOn: string[] }>;
			};
		};
	} | null;
}

type AuditEntry = NonNullable<OrderDetail["workflowRun"]>["auditLog"][number];

function StepStatus({
	step,
	auditLog,
	currentStep,
	workflowStatus,
}: {
	step: { id: string; label: string };
	auditLog: AuditEntry[];
	currentStep: string | null;
	workflowStatus: string;
}) {
	const entry = auditLog.find((a) => a.step === step.id);

	let icon: ReactNode;
	let color: string;
	if (entry?.status === "completed") {
		icon = <CheckCircle2 className="h-5 w-5 text-green-600" />;
		color = "bg-green-50 border-green-200";
	} else if (entry?.status === "failed") {
		icon = <XCircle className="h-5 w-5 text-red-600" />;
		color = "bg-red-50 border-red-200";
	} else if (currentStep === step.id && workflowStatus === "RUNNING") {
		icon = <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
		color = "bg-blue-50 border-blue-200";
	} else {
		icon = <Circle className="h-5 w-5 text-gray-300" />;
		color = "bg-gray-50 border-gray-200";
	}

	return (
		<div className={`flex items-center gap-3 rounded-md border p-3 ${color}`}>
			{icon}
			<span className="text-sm font-medium">{step.label}</span>
		</div>
	);
}

export default function OrderDetailPage() {
	const params = useParams();
	const orderId = params.id as string;
	const [order, setOrder] = useState<OrderDetail | null>(null);
	const [loading, setLoading] = useState(true);

	const fetchOrder = useCallback(async () => {
		const res = await fetch(`/api/v1/orders/${orderId}`);
		const json = await res.json();
		if (json.success) setOrder(json.data);
		setLoading(false);
	}, [orderId]);

	useEffect(() => {
		fetchOrder();
		const interval = setInterval(fetchOrder, 3000);
		return () => clearInterval(interval);
	}, [fetchOrder]);

	if (loading)
		return (
			<div className="flex h-64 items-center justify-center text-muted-foreground">
				Loading...
			</div>
		);
	if (!order)
		return (
			<div className="py-8 text-center text-muted-foreground">
				Order not found
			</div>
		);

	const dagNodes = order.workflowRun?.workflowDef?.dagJson?.nodes ?? [];
	const auditLog = order.workflowRun?.auditLog ?? [];

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Link href="/orders">
					<Button variant="ghost" size="icon">
						<ArrowLeft className="h-4 w-4" />
					</Button>
				</Link>
				<div>
					<h1 className="text-2xl font-bold">{order.orderNumber}</h1>
					<Badge variant="secondary">{order.status.replace(/_/g, " ")}</Badge>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Items</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Product</TableHead>
										<TableHead>HSN</TableHead>
										<TableHead className="text-right">Price</TableHead>
										<TableHead className="text-right">Qty</TableHead>
										<TableHead className="text-right">Total</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{order.items.map((item) => (
										<TableRow key={item.id}>
											<TableCell>
												<div className="font-medium">{item.product.name}</div>
												<div className="text-xs text-muted-foreground">
													{item.product.sku}
												</div>
											</TableCell>
											<TableCell className="font-mono text-xs">
												{item.hsnCode}
											</TableCell>
											<TableCell className="text-right">
												{formatPaiseINR(item.unitPricePaise)}
											</TableCell>
											<TableCell className="text-right">
												{item.quantity}
											</TableCell>
											<TableCell className="text-right font-medium">
												{formatPaiseINR(item.totalPaise)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
							<div className="mt-4 space-y-1 text-right text-sm">
								<div>Subtotal: {formatPaiseINR(order.subtotalPaise)}</div>
								<div>Tax: {formatPaiseINR(order.taxPaise)}</div>
								<div className="text-base font-bold">
									Total: {formatPaiseINR(order.totalPaise)}
								</div>
							</div>
						</CardContent>
					</Card>

					{dagNodes.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">
									Workflow:{" "}
									{order.workflowRun?.workflowDef?.name ?? "Order Fulfillment"}
									{order.workflowRun && (
										<Badge variant="secondary" className="ml-2">
											{order.workflowRun.status}
										</Badge>
									)}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{dagNodes.map((node: { id: string; label: string }) => (
										<StepStatus
											key={node.id}
											step={node}
											auditLog={auditLog}
											currentStep={order.workflowRun?.currentStep ?? null}
											workflowStatus={order.workflowRun?.status ?? ""}
										/>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Customer</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							<div>
								<span className="text-muted-foreground">Name:</span>{" "}
								{order.buyerName}
							</div>
							<div>
								<span className="text-muted-foreground">Email:</span>{" "}
								{order.buyerEmail}
							</div>
							<div>
								<span className="text-muted-foreground">Phone:</span>{" "}
								{order.buyerPhone}
							</div>
							<div>
								<span className="text-muted-foreground">Address:</span>{" "}
								{order.shippingAddress.line1}, {order.shippingAddress.city},{" "}
								{order.shippingAddress.state} - {order.shippingAddress.pin}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Status History</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{order.statusHistory.map((h) => (
									<div key={h.id} className="flex gap-3">
										<div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
										<div>
											<div className="text-sm font-medium">
												{h.status.replace(/_/g, " ")}
											</div>
											{h.note && (
												<div className="text-xs text-muted-foreground">
													{h.note}
												</div>
											)}
											<div className="text-xs text-muted-foreground">
												{formatDateIST(h.createdAt)}
											</div>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					<div className="text-xs text-muted-foreground">
						Created: {formatDateIST(order.createdAt)}
					</div>
				</div>
			</div>
		</div>
	);
}
