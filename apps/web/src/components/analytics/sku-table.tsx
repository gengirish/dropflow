"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn, formatPaiseINR } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

export type SkuEconomicsRow = {
	productId?: string;
	productName: string;
	sku: string;
	unitsSold: number;
	unitsReturned?: number;
	revenuePaise: number;
	cogsPaise: number;
	gstPaise: number;
	shippingPaise: number;
	gatewayFeePaise: number;
	returnCostPaise?: number;
	netProfitPaise: number;
	marginPercent: number;
};

export interface SkuTableProps {
	items: SkuEconomicsRow[];
	loading?: boolean;
}

type SortKey =
	| "productName"
	| "sku"
	| "unitsSold"
	| "revenuePaise"
	| "cogsPaise"
	| "netProfitPaise"
	| "marginPercent";

function marginBadgeVariant(
	marginPercent: number,
): "success" | "warning" | "destructive" {
	if (marginPercent > 20) return "success";
	if (marginPercent >= 10) return "warning";
	return "destructive";
}

function SortableHead({
	label,
	active,
	dir,
	onClick,
	align = "left",
}: {
	label: string;
	active: boolean;
	dir: "asc" | "desc";
	onClick: () => void;
	align?: "left" | "right";
}) {
	return (
		<TableHead
			className={cn(align === "right" && "text-right")}
		>
			<button
				type="button"
				onClick={onClick}
				className={cn(
					"inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground",
					align === "right" && "ml-auto",
				)}
			>
				{label}
				<span className="text-[10px] tabular-nums opacity-70">
					{active ? (dir === "asc" ? "↑" : "↓") : ""}
				</span>
			</button>
		</TableHead>
	);
}

export function SkuTable({ items, loading }: SkuTableProps) {
	const [sortKey, setSortKey] = useState<SortKey>("marginPercent");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

	const sorted = useMemo(() => {
		const copy = [...items];
		copy.sort((a, b) => {
			const av = a[sortKey];
			const bv = b[sortKey];
			if (typeof av === "string" && typeof bv === "string") {
				const c = av.localeCompare(bv);
				return sortDir === "asc" ? c : -c;
			}
			const an = Number(av);
			const bn = Number(bv);
			const c = an - bn;
			return sortDir === "asc" ? c : -c;
		});
		return copy;
	}, [items, sortKey, sortDir]);

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir(key === "productName" || key === "sku" ? "asc" : "desc");
		}
	}

	function rowKey(row: SkuEconomicsRow, index: number) {
		return row.productId ?? `${row.sku}::${index}`;
	}

	function toggleExpand(key: string) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	if (loading) {
		return (
			<div className="space-y-2 py-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						key={i}
						className="h-10 w-full animate-pulse rounded-md bg-muted/70"
					/>
				))}
			</div>
		);
	}

	if (sorted.length === 0) {
		return (
			<p className="py-8 text-center text-sm text-muted-foreground">
				No SKU economics data for this period.
			</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-10" />
					<SortableHead
						label="Product"
						active={sortKey === "productName"}
						dir={sortDir}
						onClick={() => toggleSort("productName")}
					/>
					<SortableHead
						label="SKU"
						active={sortKey === "sku"}
						dir={sortDir}
						onClick={() => toggleSort("sku")}
					/>
					<SortableHead
						label="Units"
						active={sortKey === "unitsSold"}
						dir={sortDir}
						onClick={() => toggleSort("unitsSold")}
						align="right"
					/>
					<SortableHead
						label="Revenue"
						active={sortKey === "revenuePaise"}
						dir={sortDir}
						onClick={() => toggleSort("revenuePaise")}
						align="right"
					/>
					<SortableHead
						label="COGS"
						active={sortKey === "cogsPaise"}
						dir={sortDir}
						onClick={() => toggleSort("cogsPaise")}
						align="right"
					/>
					<SortableHead
						label="Net profit"
						active={sortKey === "netProfitPaise"}
						dir={sortDir}
						onClick={() => toggleSort("netProfitPaise")}
						align="right"
					/>
					<SortableHead
						label="Margin"
						active={sortKey === "marginPercent"}
						dir={sortDir}
						onClick={() => toggleSort("marginPercent")}
						align="right"
					/>
				</TableRow>
			</TableHeader>
			<TableBody>
				{sorted.map((row, index) => {
					const key = rowKey(row, index);
					const isOpen = expanded.has(key);
					const variant = marginBadgeVariant(row.marginPercent);
					return (
						<Fragment key={key}>
							<TableRow>
								<TableCell className="w-10 p-2">
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 shrink-0"
										onClick={() => toggleExpand(key)}
										aria-expanded={isOpen}
										aria-label={
											isOpen ? "Hide cost breakdown" : "Show cost breakdown"
										}
									>
										{isOpen ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</Button>
								</TableCell>
								<TableCell className="max-w-[200px] truncate font-medium">
									{row.productName}
								</TableCell>
								<TableCell className="font-mono text-sm">{row.sku}</TableCell>
								<TableCell className="text-right tabular-nums">
									{row.unitsSold.toLocaleString("en-IN")}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatPaiseINR(row.revenuePaise)}
								</TableCell>
								<TableCell className="text-right tabular-nums text-muted-foreground">
									{formatPaiseINR(row.cogsPaise)}
								</TableCell>
								<TableCell
									className={cn(
										"text-right tabular-nums font-medium",
										row.netProfitPaise >= 0
											? "text-green-700"
											: "text-red-600",
									)}
								>
									{formatPaiseINR(row.netProfitPaise)}
								</TableCell>
								<TableCell className="text-right">
									<Badge
										variant={variant}
										className={cn(
											"tabular-nums",
											variant === "success" &&
												"border-green-200 bg-green-50 text-green-600",
											variant === "warning" &&
												"border-yellow-200 bg-yellow-50 text-yellow-600",
											variant === "destructive" &&
												"border-red-200 bg-red-50 text-red-600",
										)}
									>
										{row.marginPercent.toFixed(1)}%
									</Badge>
								</TableCell>
							</TableRow>
							{isOpen ? (
								<TableRow className="bg-muted/30 hover:bg-muted/40">
									<TableCell colSpan={8} className="py-3 text-sm">
										<div className="flex flex-wrap gap-x-6 gap-y-2 pl-10 text-muted-foreground">
											<span>
												<span className="font-medium text-foreground">GST: </span>
												{formatPaiseINR(row.gstPaise)}
											</span>
											<span>
												<span className="font-medium text-foreground">
													Shipping:{" "}
												</span>
												{formatPaiseINR(row.shippingPaise)}
											</span>
											<span>
												<span className="font-medium text-foreground">
													Gateway:{" "}
												</span>
												{formatPaiseINR(row.gatewayFeePaise)}
											</span>
											{row.unitsReturned != null && row.unitsReturned > 0 ? (
												<span>
													<span className="font-medium text-foreground">
														Returns (units):{" "}
													</span>
													{row.unitsReturned.toLocaleString("en-IN")}
												</span>
											) : null}
											{row.returnCostPaise != null && row.returnCostPaise > 0 ? (
												<span>
													<span className="font-medium text-foreground">
														Return cost:{" "}
													</span>
													{formatPaiseINR(row.returnCostPaise)}
												</span>
											) : null}
										</div>
									</TableCell>
								</TableRow>
							) : null}
						</Fragment>
					);
				})}
			</TableBody>
		</Table>
	);
}
