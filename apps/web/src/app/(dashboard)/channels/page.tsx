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
import type { ChannelInventorySnapshot } from "@dropflow/types";
import { Globe, Loader2, Plus, ShoppingBag, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const CHANNEL_TYPES = [
	"WEBSITE",
	"AMAZON",
	"FLIPKART",
	"MEESHO",
	"MYNTRA",
	"SHOPIFY",
	"CUSTOM",
] as const;

type ChannelRow = {
	id: string;
	name: string;
	type: string;
	status: string;
	bufferPercent: number;
	_count: { listings: number; stockAllocations: number };
};

function channelTypeIcon(type: string) {
	switch (type) {
		case "WEBSITE":
			return Globe;
		case "SHOPIFY":
		case "CUSTOM":
			return Store;
		default:
			return ShoppingBag;
	}
}

function statusBadge(status: string) {
	switch (status) {
		case "CONNECTED":
			return (
				<Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
					Connected
				</Badge>
			);
		case "ERROR":
			return <Badge variant="destructive">Error</Badge>;
		case "DISCONNECTED":
			return (
				<Badge variant="secondary" className="text-muted-foreground">
					Disconnected
				</Badge>
			);
		case "SYNCING":
			return <Badge variant="outline">Syncing</Badge>;
		case "PAUSED":
			return <Badge variant="outline">Paused</Badge>;
		default:
			return <Badge variant="outline">{status}</Badge>;
	}
}

export default function ChannelsPage() {
	const [channels, setChannels] = useState<ChannelRow[]>([]);
	const [inventory, setInventory] = useState<ChannelInventorySnapshot[]>([]);
	const [loading, setLoading] = useState(true);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [formName, setFormName] = useState("");
	const [formType, setFormType] = useState<string>(CHANNEL_TYPES[0]);
	const [formBuffer, setFormBuffer] = useState("100");

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [chRes, invRes] = await Promise.all([
				fetch("/api/v1/channels?pageSize=100"),
				fetch("/api/v1/channels/inventory"),
			]);
			const chJson = await chRes.json();
			const invJson = await invRes.json();
			if (chJson.success) {
				setChannels(chJson.data.items ?? []);
			}
			if (invJson.success) {
				setInventory(invJson.data ?? []);
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const channelNamesById = useMemo(() => {
		const m = new Map<string, string>();
		for (const c of channels) {
			m.set(c.id, c.name);
		}
		return m;
	}, [channels]);

	async function handleCreateChannel(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			const bufferPercent = Number.parseInt(formBuffer, 10);
			const res = await fetch("/api/v1/channels", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formName.trim(),
					type: formType,
					bufferPercent: Number.isFinite(bufferPercent) ? bufferPercent : 100,
					credentials: {},
					configJson: {},
				}),
			});
			const json = await res.json();
			if (json.success) {
				setDialogOpen(false);
				setFormName("");
				setFormType(CHANNEL_TYPES[0]);
				setFormBuffer("100");
				await load();
			}
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold">Channels</h1>
					<p className="text-sm text-muted-foreground">
						Multi-channel inventory and listing overview
					</p>
				</div>
				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" aria-hidden />
							Add Channel
						</Button>
					</DialogTrigger>
					<DialogContent>
						<form onSubmit={handleCreateChannel}>
							<DialogHeader>
								<DialogTitle>Add sales channel</DialogTitle>
								<DialogDescription>
									Connect a marketplace or storefront. Credentials can be added
									later via API.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="grid gap-2">
									<Label htmlFor="ch-name">Name</Label>
									<Input
										id="ch-name"
										value={formName}
										onChange={(e) => setFormName(e.target.value)}
										placeholder="e.g. Amazon IN"
										required
									/>
								</div>
								<div className="grid gap-2">
									<Label>Type</Label>
									<Select value={formType} onValueChange={setFormType}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{CHANNEL_TYPES.map((t) => (
												<SelectItem key={t} value={t}>
													{t}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="ch-buffer">Buffer % (visible stock)</Label>
									<Input
										id="ch-buffer"
										type="number"
										min={1}
										max={100}
										value={formBuffer}
										onChange={(e) => setFormBuffer(e.target.value)}
									/>
								</div>
							</div>
							<DialogFooter>
								<Button type="submit" disabled={saving || !formName.trim()}>
									{saving ? (
										<>
											<Loader2
												className="mr-2 h-4 w-4 animate-spin"
												aria-hidden
											/>
											Saving
										</>
									) : (
										"Create"
									)}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Connected channels</CardTitle>
					<CardDescription>
						Status, listings, and last-known sync state
					</CardDescription>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="flex items-center gap-2 text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							Loading…
						</div>
					) : channels.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No channels yet. Add one to get started.
						</p>
					) : (
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{channels.map((ch) => {
								const Icon = channelTypeIcon(ch.type);
								return (
									<div
										key={ch.id}
										className="flex flex-col gap-3 rounded-lg border bg-card p-4"
									>
										<div className="flex items-start justify-between gap-2">
											<div className="flex items-center gap-2">
												<div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
													<Icon
														className="h-4 w-4 text-muted-foreground"
														aria-hidden
													/>
												</div>
												<div>
													<p className="font-medium leading-tight">{ch.name}</p>
													<p className="text-xs text-muted-foreground">
														{ch.type}
													</p>
												</div>
											</div>
											{statusBadge(ch.status)}
										</div>
										<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
											<span>{ch._count.listings} listings</span>
											<span>·</span>
											<span>{ch._count.stockAllocations} stock rows</span>
											<span>·</span>
											<span>buffer {ch.bufferPercent}%</span>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Stock overview</CardTitle>
					<CardDescription>
						Per-product totals and channel allocation (allocated / available /
						visible)
					</CardDescription>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					{loading ? (
						<div className="flex items-center gap-2 text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							Loading…
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Product</TableHead>
									<TableHead>SKU</TableHead>
									<TableHead className="text-right">Total stock</TableHead>
									<TableHead className="text-right">Unallocated</TableHead>
									<TableHead>Per channel</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{inventory.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="text-center text-muted-foreground"
										>
											No active products
										</TableCell>
									</TableRow>
								) : (
									inventory.map((row) => (
										<TableRow key={row.productId}>
											<TableCell className="font-medium">
												{row.productName}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{row.sku}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{row.totalStock}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{row.unallocated}
											</TableCell>
											<TableCell className="max-w-xl">
												<div className="flex flex-col gap-1.5">
													{row.channels.map((c) => (
														<div
															key={c.channelId}
															className="flex flex-wrap items-baseline gap-x-2 gap-y-0 text-xs"
														>
															<span className="font-medium text-foreground">
																{channelNamesById.get(c.channelId) ??
																	c.channelName}
															</span>
															<span className="text-muted-foreground">
																alloc {c.allocated} · avail {c.available} · vis{" "}
																{c.visibleStock}
															</span>
														</div>
													))}
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
