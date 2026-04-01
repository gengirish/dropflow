"use client";

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
import { FileText, IndianRupee, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Invoice {
	id: string;
	invoiceNumber: string;
	gstType: string;
	subtotalPaise: number;
	cgstPaise: number;
	sgstPaise: number;
	igstPaise: number;
	totalTaxPaise: number;
	totalPaise: number;
	createdAt: string;
	order: { orderNumber: string; buyerName: string };
}

function formatINR(paise: number) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 2,
	}).format(paise / 100);
}

function formatDate(date: string) {
	return new Date(date).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: "Asia/Kolkata",
	});
}

export default function FinancePage() {
	const [invoices, setInvoices] = useState<Invoice[]>([]);
	const [loading, setLoading] = useState(true);
	const [total, setTotal] = useState(0);

	const fetchInvoices = useCallback(async () => {
		setLoading(true);
		const res = await fetch("/api/v1/invoices");
		const json = await res.json();
		if (json.success) {
			setInvoices(json.data.items);
			setTotal(json.data.total);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		fetchInvoices();
	}, [fetchInvoices]);

	const totalRevenue = invoices.reduce((s, i) => s + i.totalPaise, 0);
	const totalTax = invoices.reduce((s, i) => s + i.totalTaxPaise, 0);
	const totalCGST = invoices.reduce((s, i) => s + i.cgstPaise, 0);
	const totalSGST = invoices.reduce((s, i) => s + i.sgstPaise, 0);
	const totalIGST = invoices.reduce((s, i) => s + i.igstPaise, 0);

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-2xl font-bold">Finance</h1>
				<div className="flex flex-wrap gap-2">
					<Link
						href="/finance/margins"
						className="text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						Margin waterfall
					</Link>
					<span className="text-muted-foreground" aria-hidden>
						·
					</span>
					<Link
						href="/finance/reconciliation"
						className="text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						Reconciliation
					</Link>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
						<IndianRupee className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatINR(totalRevenue)}</div>
						<p className="text-xs text-muted-foreground">{total} invoices</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Total GST</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatINR(totalTax)}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">CGST + SGST</CardTitle>
						<FileText className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{formatINR(totalCGST + totalSGST)}
						</div>
						<p className="text-xs text-muted-foreground">
							CGST: {formatINR(totalCGST)} / SGST: {formatINR(totalSGST)}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">IGST</CardTitle>
						<FileText className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatINR(totalIGST)}</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Invoices</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Invoice #</TableHead>
								<TableHead>Order</TableHead>
								<TableHead>Customer</TableHead>
								<TableHead>GST Type</TableHead>
								<TableHead className="text-right">Subtotal</TableHead>
								<TableHead className="text-right">Tax</TableHead>
								<TableHead className="text-right">Total</TableHead>
								<TableHead>Date</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="text-center py-8 text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : invoices.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="text-center py-8 text-muted-foreground"
									>
										No invoices yet. Invoices are generated when orders are
										fulfilled.
									</TableCell>
								</TableRow>
							) : (
								invoices.map((inv) => (
									<TableRow key={inv.id}>
										<TableCell className="font-mono text-sm">
											{inv.invoiceNumber}
										</TableCell>
										<TableCell className="font-mono text-sm">
											{inv.order.orderNumber}
										</TableCell>
										<TableCell>{inv.order.buyerName}</TableCell>
										<TableCell>
											<Badge variant="secondary">{inv.gstType}</Badge>
										</TableCell>
										<TableCell className="text-right">
											{formatINR(inv.subtotalPaise)}
										</TableCell>
										<TableCell className="text-right">
											{formatINR(inv.totalTaxPaise)}
										</TableCell>
										<TableCell className="text-right font-medium">
											{formatINR(inv.totalPaise)}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{formatDate(inv.createdAt)}
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
