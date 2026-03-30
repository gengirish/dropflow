---
name: react-flow-workflows
description: >-
  React Flow workflow DAG visualization and editor for DropFlow. Use when
  building the workflow builder UI, displaying workflow run progress, or
  creating custom DAG nodes in the settings/workflow pages.
---

# React Flow — Workflow DAG Editor

Package: `@xyflow/react`

## Installation

```bash
pnpm add @xyflow/react --filter web
```

## Workflow Definition → React Flow Nodes

WorkflowDefinition.dagJson stores nodes and edges. Convert to React Flow format:

```typescript
import { Node, Edge } from "@xyflow/react";

interface DAGStep {
  id: string;
  type: string;         // "route-to-supplier" | "generate-po" | etc.
  label: string;
  config: Record<string, unknown>;
  dependsOn: string[];  // IDs of prerequisite steps
}

export function dagToReactFlow(dag: DAGStep[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = dag.map((step, i) => ({
    id: step.id,
    type: "workflowStep",
    position: { x: 250, y: i * 120 },
    data: { label: step.label, stepType: step.type, config: step.config },
  }));

  const edges: Edge[] = dag.flatMap((step) =>
    step.dependsOn.map((depId) => ({
      id: `${depId}-${step.id}`,
      source: depId,
      target: step.id,
      animated: true,
    }))
  );

  return { nodes, edges };
}
```

## Custom Workflow Step Node

```typescript
"use client";

import { Handle, Position, NodeProps } from "@xyflow/react";

const STEP_ICONS: Record<string, string> = {
  "route-to-supplier": "🔀",
  "generate-po": "📄",
  "create-shipment": "📦",
  "calculate-gst": "🧮",
  "generate-invoice-pdf": "🧾",
  "send-notification": "📧",
};

export function WorkflowStepNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm min-w-[200px]">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <span className="text-lg">{STEP_ICONS[data.stepType] ?? "⚡"}</span>
        <span className="text-sm font-medium">{data.label}</span>
      </div>
      {data.status && (
        <span className={`mt-1 text-xs ${
          data.status === "completed" ? "text-green-500" :
          data.status === "running" ? "text-blue-500" :
          data.status === "failed" ? "text-red-500" : "text-muted-foreground"
        }`}>
          {data.status}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

## Workflow Editor Component

```typescript
"use client";

import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const nodeTypes = { workflowStep: WorkflowStepNode };

export function WorkflowEditor({ definition }) {
  const { nodes, edges } = dagToReactFlow(definition.dagJson);

  return (
    <div className="h-[600px] w-full rounded-lg border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

## Live Workflow Run Visualization

Subscribe to SSE and update node statuses in real-time:

```typescript
export function WorkflowRunViewer({ runId }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useSSE({
    onEvent: (event) => {
      if (event.type === "WORKFLOW_STEP" && event.workflowRunId === runId) {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === event.step
              ? { ...n, data: { ...n.data, status: event.status } }
              : n
          )
        );
      }
    },
  });

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
      <Background />
    </ReactFlow>
  );
}
```

## Auto-Layout with Dagre

```bash
pnpm add dagre --filter web
```

```typescript
import dagre from "dagre";

export function autoLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 80 });

  nodes.forEach((n) => g.setNode(n.id, { width: 220, height: 60 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - 110, y: pos.y - 30 } };
  });
}
```
