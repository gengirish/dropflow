"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
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
import { formatPaiseINR } from "@/lib/utils";
import { Package, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Product {
	id: string;
	sku: string;
	name: string;
	hsnCode: string;
	costPricePaise: number;
	sellingPricePaise: number;
	gstRatePercent: number;
	stockQty: number;
	lowStockThreshold: number;
	isActive: boolean;
	supplier: { id: string; name: string };
}

interface Supplier {
	id: string;
	name: string;
}

export default function CatalogPage() {
	const [products, setProducts] = useState<Product[]>([]);
	const [suppliers, setSuppliers] = useState<Supplier[]>([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [total, setTotal] = useState(0);
	const [supplierId, setSupplierId] = useState("");
	const [gstRate, setGstRate] = useState("");

	const fetchProducts = useCallback(async (searchTerm = "") => {
		setLoading(true);
		const params = new URLSearchParams();
		if (searchTerm) params.set("search", searchTerm);
		const res = await fetch(`/api/v1/catalog/products?${params}`);
		const json = await res.json();
		if (json.success) {
			setProducts(json.data.items);
			setTotal(json.data.total);
		}
		setLoading(false);
	}, []);

	const fetchSuppliers = useCallback(async () => {
		const res = await fetch("/api/v1/catalog/suppliers");
		const json = await res.json();
		if (json.success) setSuppliers(json.data);
	}, []);

	useEffect(() => {
		void fetchProducts();
		void fetchSuppliers();
	}, [fetchProducts, fetchSuppliers]);

	async function handleCreateProduct(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!supplierId || gstRate === "") return;

		const form = new FormData(e.currentTarget);

		const body = {
			name: form.get("name") as string,
			sku: form.get("sku") as string,
			supplierId,
			hsnCode: form.get("hsnCode") as string,
			costPricePaise: Math.round(Number(form.get("costPrice")) * 100),
			sellingPricePaise: Math.round(Number(form.get("sellingPrice")) * 100),
			gstRatePercent: Number(gstRate),
			stockQty: Number(form.get("stockQty")),
		};

		const res = await fetch("/api/v1/catalog/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (res.ok) {
			setDialogOpen(false);
			setSupplierId("");
			setGstRate("");
			fetchProducts(search);
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Catalog</h1>
					<p className="text-muted-foreground">{total} products</p>
				</div>
				<Dialog
					open={dialogOpen}
					onOpenChange={(open) => {
						setDialogOpen(open);
						if (!open) {
							setSupplierId("");
							setGstRate("");
						}
					}}
				>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" /> Add Product
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Add Product</DialogTitle>
						</DialogHeader>
						<form onSubmit={handleCreateProduct} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="name">Product Name</Label>
									<Input id="name" name="name" required />
								</div>
								<div className="space-y-2">
									<Label htmlFor="sku">SKU</Label>
									<Input id="sku" name="sku" required />
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="supplier-select">Supplier</Label>
								<Select
									value={supplierId}
									onValueChange={setSupplierId}
									required
								>
									<SelectTrigger id="supplier-select">
										<SelectValue placeholder="Select supplier" />
									</SelectTrigger>
									<SelectContent>
										{suppliers.map((s) => (
											<SelectItem key={s.id} value={s.id}>
												{s.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="hsnCode">HSN Code</Label>
									<Input id="hsnCode" name="hsnCode" required />
								</div>
								<div className="space-y-2">
									<Label htmlFor="gst-rate-select">GST Rate %</Label>
									<Select value={gstRate} onValueChange={setGstRate} required>
										<SelectTrigger id="gst-rate-select">
											<SelectValue placeholder="Rate" />
										</SelectTrigger>
										<SelectContent>
											{[0, 3, 5, 12, 18, 28].map((r) => (
												<SelectItem key={r} value={String(r)}>
													{r}%
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="grid grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label htmlFor="costPrice">Cost (INR)</Label>
									<Input
										id="costPrice"
										name="costPrice"
										type="number"
										step="0.01"
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="sellingPrice">Sell (INR)</Label>
									<Input
										id="sellingPrice"
										name="sellingPrice"
										type="number"
										step="0.01"
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="stockQty">Stock</Label>
									<Input
										id="stockQty"
										name="stockQty"
										type="number"
										defaultValue="0"
										required
									/>
								</div>
							</div>
							<Button type="submit" className="w-full">
								Create Product
							</Button>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			<div className="flex items-center gap-4">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search products..."
						className="pl-9"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							fetchProducts(e.target.value);
						}}
					/>
				</div>
			</div>

			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Product</TableHead>
							<TableHead>SKU</TableHead>
							<TableHead>Supplier</TableHead>
							<TableHead className="text-right">Cost</TableHead>
							<TableHead className="text-right">Price</TableHead>
							<TableHead className="text-right">Stock</TableHead>
							<TableHead>Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell
									colSpan={7}
									className="text-center py-8 text-muted-foreground"
								>
									Loading...
								</TableCell>
							</TableRow>
						) : products.length === 0 ? (
							<TableRow>
								<TableCell colSpan={7} className="text-center py-8">
									<Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
									<p className="text-muted-foreground">
										No products yet. Add your first product to get started.
									</p>
								</TableCell>
							</TableRow>
						) : (
							products.map((p) => (
								<TableRow key={p.id}>
									<TableCell className="font-medium">{p.name}</TableCell>
									<TableCell className="font-mono text-xs">{p.sku}</TableCell>
									<TableCell>{p.supplier.name}</TableCell>
									<TableCell className="text-right">
										{formatPaiseINR(p.costPricePaise)}
									</TableCell>
									<TableCell className="text-right">
										{formatPaiseINR(p.sellingPricePaise)}
									</TableCell>
									<TableCell className="text-right">
										<span
											className={
												p.stockQty <= p.lowStockThreshold
													? "text-red-600 font-semibold"
													: ""
											}
										>
											{p.stockQty}
										</span>
									</TableCell>
									<TableCell>
										{p.stockQty <= p.lowStockThreshold ? (
											<Badge variant="warning">Low Stock</Badge>
										) : p.isActive ? (
											<Badge variant="success">Active</Badge>
										) : (
											<Badge variant="secondary">Inactive</Badge>
										)}
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
