"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatDateIST, formatPaiseINR } from "@/lib/utils";
import { Plus, Search, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Order {
	id: string;
	orderNumber: string;
	buyerName: string;
	buyerEmail: string;
	status: string;
	totalPaise: number;
	createdAt: string;
	_count: { items: number };
}

const STATUS_COLORS: Record<string, string> = {
	PENDING: "secondary",
	PAYMENT_PENDING: "warning",
	PAYMENT_CONFIRMED: "success",
	ROUTING: "default",
	PO_CREATED: "default",
	PROCESSING: "default",
	SHIPPED: "default",
	DELIVERED: "success",
	CANCELLED: "destructive",
	REFUNDED: "warning",
};

export default function OrdersPage() {
	const [orders, setOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("ALL");
	const [total, setTotal] = useState(0);

	const fetchOrders = useCallback(async () => {
		setLoading(true);
		const params = new URLSearchParams();
		if (search) params.set("search", search);
		if (statusFilter && statusFilter !== "ALL")
			params.set("status", statusFilter);
		const res = await fetch(`/api/v1/orders?${params}`);
		const json = await res.json();
		if (json.success) {
			setOrders(json.data.items);
			setTotal(json.data.total);
		}
		setLoading(false);
	}, [search, statusFilter]);

	useEffect(() => {
		fetchOrders();
	}, [fetchOrders]);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Orders</h1>
					<p className="text-muted-foreground">{total} orders</p>
				</div>
				<Link href="/orders/new">
					<Button>
						<Plus className="mr-2 h-4 w-4" /> Create Order
					</Button>
				</Link>
			</div>

			<div className="flex items-center gap-4">
				<div className="relative max-w-sm flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search orders..."
						className="pl-9"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="All Statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">All Statuses</SelectItem>
						<SelectItem value="PENDING">Pending</SelectItem>
						<SelectItem value="PAYMENT_CONFIRMED">Payment Confirmed</SelectItem>
						<SelectItem value="PROCESSING">Processing</SelectItem>
						<SelectItem value="SHIPPED">Shipped</SelectItem>
						<SelectItem value="DELIVERED">Delivered</SelectItem>
						<SelectItem value="CANCELLED">Cancelled</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Order</TableHead>
							<TableHead>Customer</TableHead>
							<TableHead>Items</TableHead>
							<TableHead className="text-right">Total</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Date</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="py-8 text-center text-muted-foreground"
								>
									Loading...
								</TableCell>
							</TableRow>
						) : orders.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="py-8 text-center">
									<ShoppingCart className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
									<p className="text-muted-foreground">No orders yet.</p>
								</TableCell>
							</TableRow>
						) : (
							orders.map((o) => (
								<TableRow key={o.id}>
									<TableCell>
										<Link
											href={`/orders/${o.id}`}
											className="font-mono text-sm text-primary hover:underline"
										>
											{o.orderNumber}
										</Link>
									</TableCell>
									<TableCell>
										<div className="font-medium">{o.buyerName}</div>
										<div className="text-xs text-muted-foreground">
											{o.buyerEmail}
										</div>
									</TableCell>
									<TableCell>{o._count.items}</TableCell>
									<TableCell className="text-right font-medium">
										{formatPaiseINR(o.totalPaise)}
									</TableCell>
									<TableCell>
										<Badge
											variant={
												(STATUS_COLORS[o.status] ?? "secondary") as
													| "default"
													| "secondary"
													| "destructive"
													| "outline"
													| "success"
													| "warning"
											}
										>
											{o.status.replace(/_/g, " ")}
										</Badge>
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{formatDateIST(o.createdAt)}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
