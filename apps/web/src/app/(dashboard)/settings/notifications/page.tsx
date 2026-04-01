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
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { NOTIFICATION_TRIGGERS } from "@dropflow/config";
import { format } from "date-fns";
import { Loader2, Pencil, Plus, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const CHANNEL_ORDER = ["WHATSAPP", "EMAIL", "SMS", "IN_APP"] as const;
type Channel = (typeof CHANNEL_ORDER)[number];

const TRIGGER_OPTIONS = Object.values(NOTIFICATION_TRIGGERS);

const VARIABLE_HINTS =
	"Common placeholders: {{buyerName}}, {{orderNumber}}, {{totalAmount}}, {{trackingUrl}}, {{carrier}}, {{discount}}, {{paymentLink}}";

type NotificationTemplateRow = {
	id: string;
	channel: Channel;
	triggerEvent: string;
	name: string;
	templateId: string | null;
	templateBody: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
};

type NotificationLogRow = {
	id: string;
	orderId: string | null;
	channel: Channel;
	recipientPhone: string | null;
	recipientEmail: string | null;
	status: string;
	sentAt: string | null;
	createdAt: string;
	errorMessage: string | null;
	template: { name: string; triggerEvent: string } | null;
};

function unwrapData<T>(json: unknown): T | null {
	if (!json || typeof json !== "object") return null;
	const o = json as Record<string, unknown>;
	if (o.success === true && o.data !== undefined) return o.data as T;
	return null;
}

function unwrapPaginated<T>(json: unknown): {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
} | null {
	const data = unwrapData<{
		items: T[];
		total: number;
		page: number;
		pageSize: number;
	}>(json);
	return data ?? null;
}

function channelBadgeVariant(
	channel: Channel,
): "default" | "secondary" | "outline" | "destructive" {
	switch (channel) {
		case "WHATSAPP":
			return "default";
		case "EMAIL":
			return "secondary";
		case "SMS":
			return "outline";
		default:
			return "outline";
	}
}

export default function NotificationsSettingsPage() {
	const [templates, setTemplates] = useState<NotificationTemplateRow[]>([]);
	const [logs, setLogs] = useState<NotificationLogRow[]>([]);
	const [logTotal, setLogTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [logsLoading, setLogsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<NotificationTemplateRow | null>(null);
	const [saving, setSaving] = useState(false);
	const [seeding, setSeeding] = useState(false);

	const [formChannel, setFormChannel] = useState<Channel>("WHATSAPP");
	const [formTrigger, setFormTrigger] = useState<string>(
		NOTIFICATION_TRIGGERS.ORDER_CONFIRMED,
	);
	const [formName, setFormName] = useState("");
	const [formTemplateId, setFormTemplateId] = useState("");
	const [formBody, setFormBody] = useState("");

	const loadTemplates = useCallback(async () => {
		setError(null);
		try {
			const res = await fetch("/api/v1/notifications/templates");
			const json = await res.json();
			if (!res.ok) {
				throw new Error(
					(json as { error?: { message?: string } }).error?.message ??
						"Failed to load templates",
				);
			}
			const data = unwrapData<NotificationTemplateRow[]>(json);
			setTemplates(data ?? []);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load templates");
		}
	}, []);

	const loadLogs = useCallback(async () => {
		try {
			const res = await fetch("/api/v1/notifications/logs?pageSize=25");
			const json = await res.json();
			if (!res.ok) {
				throw new Error(
					(json as { error?: { message?: string } }).error?.message ??
						"Failed to load logs",
				);
			}
			const page = unwrapPaginated<NotificationLogRow>(json);
			setLogs(page?.items ?? []);
			setLogTotal(page?.total ?? 0);
		} catch {
			setLogs([]);
			setLogTotal(0);
		}
	}, []);

	const loadAll = useCallback(async () => {
		setLoading(true);
		setLogsLoading(true);
		await Promise.all([loadTemplates(), loadLogs()]);
		setLoading(false);
		setLogsLoading(false);
	}, [loadTemplates, loadLogs]);

	useEffect(() => {
		void loadAll();
	}, [loadAll]);

	const grouped = useMemo(() => {
		const map = new Map<Channel, NotificationTemplateRow[]>();
		for (const c of CHANNEL_ORDER) map.set(c, []);
		for (const t of templates) {
			const list = map.get(t.channel);
			if (list) list.push(t);
		}
		return map;
	}, [templates]);

	function openCreate() {
		setEditing(null);
		setFormChannel("WHATSAPP");
		setFormTrigger(NOTIFICATION_TRIGGERS.ORDER_CONFIRMED);
		setFormName("");
		setFormTemplateId("");
		setFormBody("");
		setDialogOpen(true);
	}

	function openEdit(t: NotificationTemplateRow) {
		setEditing(t);
		setFormChannel(t.channel);
		setFormTrigger(t.triggerEvent);
		setFormName(t.name);
		setFormTemplateId(t.templateId ?? "");
		setFormBody(t.templateBody);
		setDialogOpen(true);
	}

	async function submitForm() {
		setSaving(true);
		setError(null);
		try {
			const base = {
				channel: formChannel,
				triggerEvent: formTrigger,
				name: formName.trim(),
				templateBody: formBody,
				...(formTemplateId.trim() ? { templateId: formTemplateId.trim() } : {}),
			};

			const url = editing
				? `/api/v1/notifications/templates/${editing.id}`
				: "/api/v1/notifications/templates";
			const res = await fetch(url, {
				method: editing ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(
					editing
						? base
						: { ...base, variables: [] as string[], isActive: true },
				),
			});
			const json = await res.json();
			if (!res.ok) {
				throw new Error(
					(json as { error?: { message?: string } }).error?.message ??
						"Save failed",
				);
			}
			setDialogOpen(false);
			await loadTemplates();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Save failed");
		} finally {
			setSaving(false);
		}
	}

	async function toggleActive(t: NotificationTemplateRow, active: boolean) {
		try {
			const res = await fetch(`/api/v1/notifications/templates/${t.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ isActive: active }),
			});
			if (!res.ok) {
				const json = await res.json();
				throw new Error(
					(json as { error?: { message?: string } }).error?.message ??
						"Update failed",
				);
			}
			setTemplates((prev) =>
				prev.map((x) => (x.id === t.id ? { ...x, isActive: active } : x)),
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Update failed");
		}
	}

	async function runSeed() {
		setSeeding(true);
		setError(null);
		try {
			const res = await fetch("/api/v1/notifications/templates/seed", {
				method: "POST",
			});
			const json = await res.json();
			if (!res.ok) {
				throw new Error(
					(json as { error?: { message?: string } }).error?.message ??
						"Seed failed (is the worker running?)",
				);
			}
			await loadTemplates();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Seed failed");
		} finally {
			setSeeding(false);
		}
	}

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
					<p className="mt-2 text-muted-foreground">
						Manage WhatsApp, email, SMS, and in-app templates. Logs show
						processed notifications from the worker queue.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="outline"
						onClick={() => void runSeed()}
						disabled={seeding}
					>
						{seeding ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
						) : (
							<Sparkles className="mr-2 h-4 w-4" aria-hidden />
						)}
						Seed defaults
					</Button>
					<Button onClick={openCreate}>
						<Plus className="mr-2 h-4 w-4" aria-hidden />
						New template
					</Button>
				</div>
			</div>

			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}

			{loading ? (
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
					Loading templates…
				</div>
			) : (
				<div className="space-y-6">
					{CHANNEL_ORDER.map((channel) => {
						const list = grouped.get(channel) ?? [];
						return (
							<Card key={channel}>
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-lg">
										{channel.replace("_", " ")}
										<Badge variant={channelBadgeVariant(channel)}>
											{list.length}
										</Badge>
									</CardTitle>
									<CardDescription>
										Templates for {channel.toLowerCase()} channel
									</CardDescription>
								</CardHeader>
								<CardContent>
									{list.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											No templates yet.
										</p>
									) : (
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Trigger</TableHead>
													<TableHead>Name</TableHead>
													<TableHead>Preview</TableHead>
													<TableHead className="w-[100px]">Active</TableHead>
													<TableHead className="w-[80px]" />
												</TableRow>
											</TableHeader>
											<TableBody>
												{list.map((t) => (
													<TableRow key={t.id}>
														<TableCell className="font-mono text-xs">
															{t.triggerEvent}
														</TableCell>
														<TableCell className="font-medium">
															{t.name}
														</TableCell>
														<TableCell className="max-w-md truncate text-muted-foreground text-sm">
															{t.templateBody}
														</TableCell>
														<TableCell>
															<Switch
																checked={t.isActive}
																onCheckedChange={(v) => void toggleActive(t, v)}
																aria-label={`Active ${t.name}`}
															/>
														</TableCell>
														<TableCell>
															<Button
																variant="ghost"
																size="icon"
																onClick={() => openEdit(t)}
																aria-label={`Edit ${t.name}`}
															>
																<Pencil className="h-4 w-4" aria-hidden />
															</Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Recent notification logs</CardTitle>
					<CardDescription>
						{logTotal} total · showing latest {Math.min(logs.length, 25)}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{logsLoading ? (
						<div className="flex items-center gap-2 text-muted-foreground">
							<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
							Loading logs…
						</div>
					) : logs.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No logs yet. Send a test from the API or complete an order
							workflow.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Time</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Channel</TableHead>
									<TableHead>Recipient</TableHead>
									<TableHead>Order</TableHead>
									<TableHead>Template</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{logs.map((log) => (
									<TableRow key={log.id}>
										<TableCell className="whitespace-nowrap text-sm">
											{format(new Date(log.createdAt), "MMM d, HH:mm")}
										</TableCell>
										<TableCell>
											<Badge
												variant={
													log.status === "SENT"
														? "default"
														: log.status === "FAILED"
															? "destructive"
															: "secondary"
												}
											>
												{log.status}
											</Badge>
										</TableCell>
										<TableCell>
											<Badge variant="outline">{log.channel}</Badge>
										</TableCell>
										<TableCell className="max-w-[200px] truncate text-sm">
											{log.recipientPhone ?? log.recipientEmail ?? "—"}
										</TableCell>
										<TableCell className="font-mono text-xs">
											{log.orderId ?? "—"}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{log.template?.name ?? "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>
							{editing ? "Edit template" : "Create template"}
						</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						<div className="grid gap-2">
							<Label htmlFor="channel">Channel</Label>
							<Select
								value={formChannel}
								onValueChange={(v) => setFormChannel(v as Channel)}
							>
								<SelectTrigger id="channel">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{CHANNEL_ORDER.map((c) => (
										<SelectItem key={c} value={c}>
											{c}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="trigger">Trigger event</Label>
							<Select value={formTrigger} onValueChange={setFormTrigger}>
								<SelectTrigger id="trigger">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TRIGGER_OPTIONS.map((ev) => (
										<SelectItem key={ev} value={ev}>
											{ev}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								value={formName}
								onChange={(e) => setFormName(e.target.value)}
								placeholder="e.g. Order confirmed — WhatsApp"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="providerTpl">
								Provider template ID (optional)
							</Label>
							<Input
								id="providerTpl"
								value={formTemplateId}
								onChange={(e) => setFormTemplateId(e.target.value)}
								placeholder="Gupshup template name"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="body">Template body</Label>
							<Textarea
								id="body"
								rows={6}
								value={formBody}
								onChange={(e) => setFormBody(e.target.value)}
								placeholder="Hi {{buyerName}}! …"
							/>
							<p className="text-xs text-muted-foreground">{VARIABLE_HINTS}</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={() => void submitForm()}
							disabled={
								saving || !formName.trim() || !formBody.trim() || !formTrigger
							}
						>
							{saving ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
							) : null}
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
