"use client";

import { cn } from "@/lib/utils";
import type { WorkflowStepHandler } from "@/lib/workflow-dag";
import {
	Boxes,
	FileText,
	GitBranch,
	GripVertical,
	Package,
} from "lucide-react";

const PALETTE_ITEMS: {
	handler: WorkflowStepHandler;
	label: string;
	description: string;
	icon: typeof Package;
}[] = [
	{
		handler: "validate-stock",
		label: "Validate stock",
		description: "Check inventory availability before fulfillment.",
		icon: Boxes,
	},
	{
		handler: "route-to-supplier",
		label: "Route to supplier",
		description: "Select supplier and assign routing for the order.",
		icon: GitBranch,
	},
	{
		handler: "generate-po",
		label: "Generate PO",
		description: "Create purchase order documents for suppliers.",
		icon: FileText,
	},
	{
		handler: "create-shipment",
		label: "Create shipment",
		description: "Open a shipment record and advance order status.",
		icon: Package,
	},
];

const DRAG_MIME = "application/dropflow-workflow-step";

export function NodePalette({ className }: { className?: string }) {
	return (
		<aside
			className={cn(
				"flex w-full shrink-0 flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm lg:w-64",
				className,
			)}
		>
			<div>
				<h2 className="text-sm font-semibold">Step types</h2>
				<p className="mt-1 text-xs text-muted-foreground">
					Drag a step onto the canvas. Connect bottom to top to set execution
					order.
				</p>
			</div>
			<ul className="flex flex-row flex-wrap gap-2 lg:flex-col">
				{PALETTE_ITEMS.map((item) => (
					<li key={item.handler}>
						<button
							type="button"
							draggable
							onDragStart={(e) => {
								e.dataTransfer.setData(
									DRAG_MIME,
									JSON.stringify({
										handler: item.handler,
										label: item.label,
									}),
								);
								e.dataTransfer.effectAllowed = "copy";
							}}
							className={cn(
								"flex w-full cursor-grab items-start gap-2 rounded-lg border bg-background p-3 text-left text-sm shadow-sm transition-colors",
								"hover:bg-accent/50 active:cursor-grabbing",
							)}
						>
							<GripVertical
								className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
								aria-hidden
							/>
							<item.icon
								className="mt-0.5 h-4 w-4 shrink-0 text-primary"
								aria-hidden
							/>
							<span className="min-w-0 flex-1">
								<span className="block font-medium">{item.label}</span>
								<span className="mt-0.5 block text-xs text-muted-foreground">
									{item.description}
								</span>
							</span>
						</button>
					</li>
				))}
			</ul>
		</aside>
	);
}

export { DRAG_MIME };
