"use client";

import { cn } from "@/lib/utils";
import {
	Background,
	BackgroundVariant,
	type Connection,
	Controls,
	type Edge,
	MiniMap,
	type Node,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
	ReactFlow,
	addEdge,
	useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback } from "react";
import { ActionNode } from "./action-node";
import { DRAG_MIME } from "./node-palette";

const nodeTypes = { action: ActionNode };

export type WorkflowCanvasProps = {
	nodes: Node[];
	edges: Edge[];
	onNodesChange: OnNodesChange;
	onEdgesChange: OnEdgesChange;
	onConnect: OnConnect;
	onDropStep?: (
		handler: string,
		label: string,
		position: { x: number; y: number },
	) => void;
	readOnly?: boolean;
	className?: string;
};

function WorkflowCanvasInner({
	nodes,
	edges,
	onNodesChange,
	onEdgesChange,
	onConnect,
	onDropStep,
	readOnly = false,
	className,
}: WorkflowCanvasProps) {
	const { screenToFlowPosition } = useReactFlow();

	const onDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	}, []);

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			if (!onDropStep) return;
			const raw = e.dataTransfer.getData(DRAG_MIME);
			if (!raw) return;
			try {
				const parsed = JSON.parse(raw) as { handler?: string; label?: string };
				if (
					typeof parsed.handler !== "string" ||
					typeof parsed.label !== "string"
				)
					return;
				const position = screenToFlowPosition({
					x: e.clientX,
					y: e.clientY,
				});
				onDropStep(parsed.handler, parsed.label, position);
			} catch {
				/* ignore malformed drop */
			}
		},
		[onDropStep, screenToFlowPosition],
	);

	return (
		<div
			className={cn(
				"min-h-0 min-w-0 flex-1 rounded-lg border bg-muted/15",
				className,
			)}
			onDrop={onDrop}
			onDragOver={onDragOver}
		>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				nodeTypes={nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.2 }}
				deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
				nodesDraggable={!readOnly}
				nodesConnectable={!readOnly}
				elementsSelectable={!readOnly}
				connectionLineStyle={{ stroke: "hsl(var(--primary))", strokeWidth: 2 }}
				proOptions={{ hideAttribution: true }}
				className="bg-transparent"
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={18}
					size={1}
					className="bg-muted/5"
				/>
				<Controls
					showInteractive={false}
					className="!m-3 overflow-hidden rounded-lg border bg-card shadow-md"
				/>
				<MiniMap
					className="!m-3 overflow-hidden rounded-lg border bg-card shadow-md"
					zoomable
					pannable
					maskColor="rgb(0 0 0 / 12%)"
				/>
			</ReactFlow>
		</div>
	);
}

/** Renders the flow surface; wrap with `ReactFlowProvider` from `@xyflow/react` in the parent. */
export function WorkflowCanvas(props: WorkflowCanvasProps) {
	return <WorkflowCanvasInner {...props} />;
}

export function connectAddsAnimatedEdge(
	connection: Connection,
	edges: Edge[],
): Edge[] {
	return addEdge({ ...connection, animated: true }, edges);
}
