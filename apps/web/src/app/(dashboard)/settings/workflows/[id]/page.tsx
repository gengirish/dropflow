"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NodePalette } from "@/components/workflow/node-palette";
import {
	WorkflowCanvas,
	connectAddsAnimatedEdge,
} from "@/components/workflow/workflow-canvas";
import {
	dagNodesToReactFlow,
	parseDagJson,
	reactFlowToDagNodes,
} from "@/lib/workflow-dag";
import { createId } from "@paralleldrive/cuid2";
import {
	type Connection,
	type Edge,
	type Node,
	ReactFlowProvider,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import { ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type WorkflowDetail = {
	id: string;
	name: string;
	trigger: string;
	version: number;
	status: "ACTIVE" | "PAUSED" | "ARCHIVED";
	dagJson: unknown;
	updatedAt: string;
	totalRuns: number;
	recentRunsCount: number;
	lastRun: {
		id: string;
		status: string;
		startedAt: string;
	} | null;
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
	status: WorkflowDetail["status"],
): "success" | "warning" | "secondary" {
	if (status === "ACTIVE") return "success";
	if (status === "PAUSED") return "warning";
	return "secondary";
}

function WorkflowEditorBody({ workflowId }: { workflowId: string }) {
	const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
	const [hydratedKey, setHydratedKey] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveMsg, setSaveMsg] = useState<string | null>(null);
	const [validationMsg, setValidationMsg] = useState<string | null>(null);
	const [validationOk, setValidationOk] = useState<boolean | null>(null);

	const load = useCallback(async () => {
		setLoadError(null);
		try {
			const res = await fetch(`/api/v1/workflows/${workflowId}`);
			const data = await parseApi<WorkflowDetail>(res);
			setWorkflow(data);
		} catch (e) {
			setLoadError(e instanceof Error ? e.message : "Failed to load workflow");
		}
	}, [workflowId]);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		if (!workflow) return;
		const key = `${workflow.id}:${workflow.updatedAt}`;
		if (hydratedKey === key) return;
		const parsed = parseDagJson(workflow.dagJson);
		const dagNodes = parsed ?? [];
		const { nodes: n, edges: e } = dagNodesToReactFlow(dagNodes);
		setNodes(n);
		setEdges(e);
		setHydratedKey(key);
		setValidationMsg(null);
		setValidationOk(null);
		setSaveMsg(null);
	}, [workflow, hydratedKey, setNodes, setEdges]);

	const readOnly = workflow?.status === "ARCHIVED";

	const onConnect = useCallback(
		(c: Connection) => setEdges((eds) => connectAddsAnimatedEdge(c, eds)),
		[setEdges],
	);

	const onDropStep = useCallback(
		(handler: string, label: string, position: { x: number; y: number }) => {
			if (readOnly) return;
			const id = createId();
			setNodes((nds) => [
				...nds,
				{
					id,
					type: "action",
					position,
					data: { label, handler },
				},
			]);
			setValidationOk(null);
			setValidationMsg(null);
		},
		[readOnly, setNodes],
	);

	const onValidate = useCallback(() => {
		const r = reactFlowToDagNodes(nodes, edges);
		if (r.ok) {
			setValidationOk(true);
			setValidationMsg(
				"Graph is valid: handlers are known and there are no cycles.",
			);
		} else {
			setValidationOk(false);
			setValidationMsg(r.error.message);
		}
	}, [nodes, edges]);

	const onSave = useCallback(async () => {
		if (!workflow || readOnly) return;
		const r = reactFlowToDagNodes(nodes, edges);
		if (!r.ok) {
			setValidationOk(false);
			setValidationMsg(r.error.message);
			return;
		}
		setSaving(true);
		setSaveMsg(null);
		try {
			const res = await fetch(`/api/v1/workflows/${workflow.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ nodes, edges }),
			});
			const updated = await parseApi<{ updatedAt: string; dagJson: unknown }>(
				res,
			);
			setWorkflow((w) =>
				w
					? {
							...w,
							updatedAt: updated.updatedAt,
							dagJson: updated.dagJson,
						}
					: w,
			);
			setHydratedKey(null);
			setSaveMsg("Saved successfully.");
			setValidationOk(true);
			setValidationMsg(null);
		} catch (e) {
			setSaveMsg(e instanceof Error ? e.message : "Save failed");
		} finally {
			setSaving(false);
		}
	}, [workflow, readOnly, nodes, edges]);

	if (loadError) {
		return (
			<div className="space-y-4">
				<p className="text-destructive">{loadError}</p>
				<Button variant="outline" asChild>
					<Link href="/settings/workflows">Back to workflows</Link>
				</Button>
			</div>
		);
	}

	if (!workflow) {
		return (
			<div className="flex h-[50vh] items-center justify-center text-muted-foreground">
				<Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" />
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100vh-5.5rem)] min-h-[520px] flex-col gap-4">
			<div className="flex shrink-0 flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-wrap items-center gap-3">
					<Button variant="ghost" size="sm" className="gap-1.5 px-2" asChild>
						<Link href="/settings/workflows">
							<ArrowLeft className="h-4 w-4" aria-hidden />
							Back
						</Link>
					</Button>
					<div className="min-w-0">
						<h1 className="truncate text-xl font-bold tracking-tight">
							{workflow.name}
						</h1>
						<p className="text-xs text-muted-foreground">
							<code className="rounded bg-muted px-1">{workflow.trigger}</code>
							<span className="mx-2">·</span>
							<span>v{workflow.version}</span>
							<span className="mx-2">·</span>
							<span>{workflow.totalRuns} runs</span>
							{workflow.lastRun ? (
								<>
									<span className="mx-2">·</span>
									<span>Last: {workflow.lastRun.status}</span>
								</>
							) : null}
						</p>
					</div>
					<Badge variant={statusBadgeVariant(workflow.status)}>
						{workflow.status}
					</Badge>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{validationMsg ? (
						<span
							className={
								validationOk === false
									? "max-w-xs text-sm text-destructive"
									: "max-w-xs text-sm text-green-700 dark:text-green-400"
							}
						>
							{validationMsg}
						</span>
					) : null}
					{saveMsg ? (
						<span
							className={
								saveMsg.includes("success")
									? "text-sm text-green-700 dark:text-green-400"
									: "text-sm text-destructive"
							}
						>
							{saveMsg}
						</span>
					) : null}
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={onValidate}
						disabled={readOnly}
					>
						<CheckCircle2 className="h-4 w-4" aria-hidden />
						Validate
					</Button>
					<Button
						type="button"
						size="sm"
						className="gap-1.5"
						onClick={() => void onSave()}
						disabled={readOnly || saving}
					>
						{saving ? (
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
						) : (
							<Save className="h-4 w-4" aria-hidden />
						)}
						Save
					</Button>
				</div>
			</div>

			{readOnly ? (
				<p className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
					This workflow is archived. Unarchive is not available from the UI —
					duplicate the definition if you need an active copy.
				</p>
			) : null}

			<div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
				{readOnly ? null : <NodePalette />}
				<WorkflowCanvas
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					onDropStep={readOnly ? undefined : onDropStep}
					readOnly={readOnly}
					className="min-h-[400px]"
				/>
			</div>
		</div>
	);
}

export default function WorkflowEditorPage() {
	const params = useParams();
	const id = typeof params.id === "string" ? params.id : "";

	return (
		<ReactFlowProvider>
			<WorkflowEditorBody workflowId={id} />
		</ReactFlowProvider>
	);
}
