"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatDistanceToNow } from "date-fns";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type WorkflowRow = {
	id: string;
	name: string;
	trigger: string;
	version: number;
	status: "ACTIVE" | "PAUSED" | "ARCHIVED";
	createdAt: string;
	updatedAt: string;
	runsCount: number;
};

async function parseApi<T>(res: Response): Promise<T> {
	const json = (await res.json()) as
		| { success: true; data: T }
		| { success: false; error: { code: string; message: string } };
	if (!json.success) {
		throw new Error(json.error.message);
	}
	return json.data;
}

function statusBadgeVariant(
	status: WorkflowRow["status"],
): "success" | "warning" | "secondary" {
	if (status === "ACTIVE") return "success";
	if (status === "PAUSED") return "warning";
	return "secondary";
}

export default function WorkflowsSettingsPage() {
	const router = useRouter();
	const [items, setItems] = useState<WorkflowRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [createName, setCreateName] = useState("");
	const [createTrigger, setCreateTrigger] = useState("order.created");
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/v1/workflows");
			const data = await parseApi<WorkflowRow[]>(res);
			setItems(data);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load workflows");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const onCreate = async () => {
		setCreating(true);
		setCreateError(null);
		try {
			const res = await fetch("/api/v1/workflows", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: createName.trim(),
					trigger: createTrigger.trim(),
					nodes: [],
					edges: [],
				}),
			});
			const created = await parseApi<{ id: string }>(res);
			setDialogOpen(false);
			setCreateName("");
			setCreateTrigger("order.created");
			router.push(`/settings/workflows/${created.id}`);
		} catch (e) {
			setCreateError(e instanceof Error ? e.message : "Create failed");
		} finally {
			setCreating(false);
		}
	};

	const onStatusChange = async (id: string, status: "ACTIVE" | "PAUSED") => {
		try {
			const res = await fetch(`/api/v1/workflows/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status }),
			});
			await parseApi<{ id: string }>(res);
			setItems((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
		} catch {
			void load();
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
					<p className="mt-1 text-muted-foreground">
						Visual DAG definitions executed by the DropFlow worker when triggers
						fire.
					</p>
				</div>
				<Button onClick={() => setDialogOpen(true)} className="shrink-0 gap-2">
					<Plus className="h-4 w-4" aria-hidden />
					Create workflow
				</Button>
			</div>

			{error ? (
				<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			) : null}

			<div className="rounded-lg border bg-card shadow-sm">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Trigger</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Version</TableHead>
							<TableHead className="text-right">Runs</TableHead>
							<TableHead className="text-right">Last updated</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="h-24 text-center text-muted-foreground"
								>
									<span className="inline-flex items-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										Loading workflows…
									</span>
								</TableCell>
							</TableRow>
						) : items.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="h-24 text-center text-muted-foreground"
								>
									No workflows yet. Create one to start building your automation
									graph.
								</TableCell>
							</TableRow>
						) : (
							items.map((w) => (
								<TableRow
									key={w.id}
									className="cursor-pointer"
									onClick={() => router.push(`/settings/workflows/${w.id}`)}
								>
									<TableCell className="font-medium">{w.name}</TableCell>
									<TableCell>
										<code className="rounded bg-muted px-1.5 py-0.5 text-xs">
											{w.trigger}
										</code>
									</TableCell>
									<TableCell onClick={(e) => e.stopPropagation()}>
										{w.status === "ARCHIVED" ? (
											<Badge variant={statusBadgeVariant(w.status)}>
												{w.status}
											</Badge>
										) : (
											<Select
												value={w.status}
												onValueChange={(v) => {
													if (v === "ACTIVE" || v === "PAUSED") {
														void onStatusChange(w.id, v);
													}
												}}
											>
												<SelectTrigger className="h-8 w-[120px]">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="ACTIVE">ACTIVE</SelectItem>
													<SelectItem value="PAUSED">PAUSED</SelectItem>
												</SelectContent>
											</Select>
										)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{w.version}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{w.runsCount}
									</TableCell>
									<TableCell className="text-right text-muted-foreground">
										{formatDistanceToNow(new Date(w.updatedAt), {
											addSuffix: true,
										})}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			<p className="text-xs text-muted-foreground">
				Need help? Open a workflow to edit the DAG. Archived workflows are
				read-only in the editor.
			</p>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New workflow</DialogTitle>
						<DialogDescription>
							Choose a name and trigger. You will define steps on the next
							screen.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						<div className="grid gap-2">
							<Label htmlFor="wf-name">Name</Label>
							<Input
								id="wf-name"
								value={createName}
								onChange={(e) => setCreateName(e.target.value)}
								placeholder="e.g. Standard order fulfillment"
								autoComplete="off"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="wf-trigger">Trigger</Label>
							<Input
								id="wf-trigger"
								value={createTrigger}
								onChange={(e) => setCreateTrigger(e.target.value)}
								placeholder="order.created"
								autoComplete="off"
							/>
						</div>
						{createError ? (
							<p className="text-sm text-destructive">{createError}</p>
						) : null}
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							type="button"
							variant="outline"
							onClick={() => setDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={creating || !createName.trim() || !createTrigger.trim()}
							onClick={() => void onCreate()}
						>
							{creating ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
									Creating…
								</>
							) : (
								"Continue"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
