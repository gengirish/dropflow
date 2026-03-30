"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPaiseINR } from "@/lib/utils";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Product {
	id: string;
	name: string;
	sku: string;
	sellingPricePaise: number;
	stockQty: number;
	reservedQty: number;
}

interface CartItem {
	productId: string;
	product: Product;
	quantity: number;
}

export default function NewOrderPage() {
	const router = useRouter();
	const [products, setProducts] = useState<Product[]>([]);
	const [cart, setCart] = useState<CartItem[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchProducts = useCallback(async () => {
		const res = await fetch("/api/v1/catalog/products?pageSize=100");
		const json = await res.json();
		if (json.success) setProducts(json.data.items);
	}, []);

	useEffect(() => {
		fetchProducts();
	}, [fetchProducts]);

	function addToCart(product: Product) {
		setCart((prev) => {
			const existing = prev.find((c) => c.productId === product.id);
			if (existing) {
				return prev.map((c) =>
					c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c,
				);
			}
			return [...prev, { productId: product.id, product, quantity: 1 }];
		});
	}

	function updateQty(productId: string, delta: number) {
		setCart((prev) =>
			prev
				.map((c) =>
					c.productId === productId
						? { ...c, quantity: c.quantity + delta }
						: c,
				)
				.filter((c) => c.quantity > 0),
		);
	}

	const subtotal = cart.reduce(
		(s, c) => s + c.product.sellingPricePaise * c.quantity,
		0,
	);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (cart.length === 0) return;
		setSubmitting(true);
		setError(null);

		const form = new FormData(e.currentTarget);

		const body = {
			buyerName: form.get("buyerName") as string,
			buyerEmail: form.get("buyerEmail") as string,
			buyerPhone: form.get("buyerPhone") as string,
			shippingAddress: {
				line1: form.get("line1") as string,
				line2: (form.get("line2") as string) || "",
				city: form.get("city") as string,
				state: form.get("state") as string,
				pin: form.get("pin") as string,
				country: "IN",
			},
			billingAddress: {
				line1: form.get("line1") as string,
				line2: (form.get("line2") as string) || "",
				city: form.get("city") as string,
				state: form.get("state") as string,
				pin: form.get("pin") as string,
				country: "IN",
			},
			items: cart.map((c) => ({
				productId: c.productId,
				quantity: c.quantity,
			})),
		};

		try {
			const res = await fetch("/api/v1/orders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const json = await res.json();

			if (json.success) {
				router.push(`/orders/${json.data.id}`);
			} else {
				setError(json.error?.message ?? "Failed to create order");
			}
		} catch {
			setError("Network error");
		}
		setSubmitting(false);
	}

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<h1 className="text-2xl font-bold">Create Order</h1>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
				<div className="space-y-6 lg:col-span-3">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Select Products</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{products.map((p) => (
									<div
										key={p.id}
										className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50"
									>
										<div>
											<div className="font-medium">{p.name}</div>
											<div className="text-sm text-muted-foreground">
												{p.sku} &middot; {formatPaiseINR(p.sellingPricePaise)}{" "}
												&middot; Stock: {p.stockQty - p.reservedQty}
											</div>
										</div>
										<Button
											size="sm"
											variant="outline"
											type="button"
											onClick={() => addToCart(p)}
										>
											<Plus className="h-4 w-4" />
										</Button>
									</div>
								))}
								{products.length === 0 && (
									<p className="py-4 text-center text-muted-foreground">
										No products available. Add products first.
									</p>
								)}
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Cart ({cart.length})</CardTitle>
						</CardHeader>
						<CardContent>
							{cart.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									Add products to the cart
								</p>
							) : (
								<div className="space-y-3">
									{cart.map((c) => (
										<div
											key={c.productId}
											className="flex items-center justify-between"
										>
											<div className="min-w-0 flex-1">
												<div className="truncate text-sm font-medium">
													{c.product.name}
												</div>
												<div className="text-xs text-muted-foreground">
													{formatPaiseINR(c.product.sellingPricePaise)} each
												</div>
											</div>
											<div className="flex items-center gap-2">
												<Button
													size="icon"
													variant="ghost"
													type="button"
													className="h-7 w-7"
													onClick={() => updateQty(c.productId, -1)}
												>
													<Minus className="h-3 w-3" />
												</Button>
												<span className="w-6 text-center text-sm">
													{c.quantity}
												</span>
												<Button
													size="icon"
													variant="ghost"
													type="button"
													className="h-7 w-7"
													onClick={() => updateQty(c.productId, 1)}
												>
													<Plus className="h-3 w-3" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													type="button"
													className="h-7 w-7 text-destructive"
													onClick={() => updateQty(c.productId, -c.quantity)}
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
										</div>
									))}
									<div className="flex justify-between border-t pt-3 font-semibold">
										<span>Subtotal</span>
										<span>{formatPaiseINR(subtotal)}</span>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Customer Details</CardTitle>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSubmit} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="buyerName">Name</Label>
									<Input id="buyerName" name="buyerName" required />
								</div>
								<div className="space-y-2">
									<Label htmlFor="buyerEmail">Email</Label>
									<Input
										id="buyerEmail"
										name="buyerEmail"
										type="email"
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="buyerPhone">Phone (+91)</Label>
									<Input
										id="buyerPhone"
										name="buyerPhone"
										placeholder="+919876543210"
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="line1">Address Line 1</Label>
									<Input id="line1" name="line1" required />
								</div>
								<div className="space-y-2">
									<Label htmlFor="line2">Address Line 2</Label>
									<Input id="line2" name="line2" />
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="city">City</Label>
										<Input id="city" name="city" required />
									</div>
									<div className="space-y-2">
										<Label htmlFor="state">State</Label>
										<Input id="state" name="state" required />
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="pin">PIN Code</Label>
									<Input id="pin" name="pin" pattern="\d{6}" required />
								</div>

								{error && <p className="text-sm text-destructive">{error}</p>}

								<Button
									type="submit"
									className="w-full"
									disabled={cart.length === 0 || submitting}
								>
									{submitting
										? "Creating..."
										: `Place Order (${formatPaiseINR(subtotal)})`}
								</Button>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
