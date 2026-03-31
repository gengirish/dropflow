"use client";

import { cn } from "@/lib/utils";
import type { WorkflowStepHandler } from "@/lib/workflow-dag";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Boxes, FileText, GitBranch, Package, Settings2 } from "lucide-react";

export type ActionNodeData = {
	label: string;
	handler: string;
	config?: Record<string, unknown>;
};

const HANDLER_META: Record<
	WorkflowStepHandler,
	{ icon: typeof Package; className: string }
> = {
	"validate-stock": {
		icon: Boxes,
		className:
			"border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-100",
	},
	"route-to-supplier": {
		icon: GitBranch,
		className:
			"border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100",
	},
	"generate-po": {
		icon: FileText,
		className:
			"border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
	},
	"create-shipment": {
		icon: Package,
		className:
			"border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
	},
};

function metaFor(handler: string) {
	const m = HANDLER_META[handler as WorkflowStepHandler];
	if (m) return m;
	return {
		icon: Package,
		className: "border-muted bg-muted/40 text-foreground",
	};
}

export function ActionNode({ data, selected }: NodeProps) {
	const d = data as ActionNodeData;
	const { icon: Icon, className: tone } = metaFor(d.handler);
	const hasConfig =
		d.config !== undefined &&
		typeof d.config === "object" &&
		d.config !== null &&
		Object.keys(d.config).length > 0;

	return (
		<div
			className={cn(
				"relative min-w-[200px] max-w-[260px] rounded-xl border-2 px-3 py-2.5 shadow-sm transition-shadow",
				tone,
				selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
			)}
		>
			<Handle
				type="target"
				position={Position.Top}
				className="!h-3 !w-3 !border-2 !bg-background"
			/>
			<div className="flex items-start gap-2.5">
				<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/60">
					<Icon className="h-4 w-4 opacity-90" aria-hidden />
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-semibold leading-tight">
						{d.label}
					</p>
					<p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
						{d.handler}
					</p>
					{hasConfig ? (
						<div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
							<Settings2 className="h-3 w-3 shrink-0" aria-hidden />
							<span>Config set</span>
						</div>
					) : null}
				</div>
			</div>
			<Handle
				type="source"
				position={Position.Bottom}
				className="!h-3 !w-3 !border-2 !bg-background"
			/>
		</div>
	);
}
