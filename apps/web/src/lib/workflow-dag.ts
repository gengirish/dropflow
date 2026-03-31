import type { Edge, Node } from "@xyflow/react";

/** Must match `apps/worker/src/dag/step-registry.ts` */
export const WORKFLOW_STEP_HANDLERS = [
	"validate-stock",
	"route-to-supplier",
	"generate-po",
	"create-shipment",
] as const;

export type WorkflowStepHandler = (typeof WORKFLOW_STEP_HANDLERS)[number];

const HANDLER_SET = new Set<string>(WORKFLOW_STEP_HANDLERS);

export interface DAGNode {
	id: string;
	label: string;
	handler: string;
	dependsOn: string[];
	config?: Record<string, unknown>;
}

export interface DAGDefinition {
	nodes: DAGNode[];
}

export type WorkflowValidationErrorCode =
	| "UNKNOWN_HANDLER"
	| "INVALID_NODE"
	| "INVALID_EDGE"
	| "CYCLE_DETECTED"
	| "MISSING_NODE_DATA";

export interface WorkflowValidationError {
	code: WorkflowValidationErrorCode;
	message: string;
}

export interface RFNodeData {
	label: string;
	handler: string;
	config?: Record<string, unknown>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Directed cycle in the execution graph (source → target). */
export function hasDirectedCycle(
	nodeIds: Set<string>,
	edges: Array<{ source: string; target: string }>,
): boolean {
	const adj = new Map<string, string[]>();
	for (const id of nodeIds) adj.set(id, []);
	for (const e of edges) {
		if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
		if (e.source === e.target) return true;
		adj.get(e.source)?.push(e.target);
	}

	const visited = new Set<string>();
	const stack = new Set<string>();

	function dfs(u: string): boolean {
		if (stack.has(u)) return true;
		if (visited.has(u)) return false;
		visited.add(u);
		stack.add(u);
		for (const v of adj.get(u) ?? []) {
			if (dfs(v)) return true;
		}
		stack.delete(u);
		return false;
	}

	for (const id of nodeIds) {
		if (!visited.has(id) && dfs(id)) return true;
	}
	return false;
}

export function reactFlowToDagNodes(
	nodes: Node[],
	edges: Edge[],
):
	| { ok: true; dag: DAGNode[] }
	| { ok: false; error: WorkflowValidationError } {
	const idSet = new Set(nodes.map((n) => n.id));
	const rfEdges = edges.map((e) => ({ source: e.source, target: e.target }));

	for (const e of rfEdges) {
		if (!idSet.has(e.source) || !idSet.has(e.target)) {
			return {
				ok: false,
				error: {
					code: "INVALID_EDGE",
					message: `Edge references unknown node: ${e.source} → ${e.target}`,
				},
			};
		}
	}

	if (hasDirectedCycle(idSet, rfEdges)) {
		return {
			ok: false,
			error: {
				code: "CYCLE_DETECTED",
				message: "Workflow graph contains a cycle",
			},
		};
	}

	const dependsOn = new Map<string, Set<string>>();
	for (const id of idSet) dependsOn.set(id, new Set());
	for (const e of rfEdges) {
		dependsOn.get(e.target)?.add(e.source);
	}

	const dag: DAGNode[] = [];

	for (const n of nodes) {
		const data = n.data as unknown as RFNodeData | undefined;
		if (
			!data ||
			typeof data.handler !== "string" ||
			typeof data.label !== "string"
		) {
			return {
				ok: false,
				error: {
					code: "MISSING_NODE_DATA",
					message: `Node "${n.id}" is missing label or handler`,
				},
			};
		}
		if (!HANDLER_SET.has(data.handler)) {
			return {
				ok: false,
				error: {
					code: "UNKNOWN_HANDLER",
					message: `Unknown step handler: ${data.handler}`,
				},
			};
		}
		const deps = [...(dependsOn.get(n.id) ?? [])];
		dag.push({
			id: n.id,
			label: data.label,
			handler: data.handler,
			dependsOn: deps,
			config:
				data.config &&
				isRecord(data.config) &&
				Object.keys(data.config).length > 0
					? data.config
					: undefined,
		});
	}

	return { ok: true, dag };
}

const LAYER_GAP_Y = 200;
const NODE_GAP_X = 280;

/** Longest-path layering from roots (nodes with no incoming edges). */
function computeLayers(dagNodes: DAGNode[]): Map<string, number> {
	const ids = new Set(dagNodes.map((n) => n.id));
	const incoming = new Map<string, Set<string>>();
	for (const n of dagNodes) incoming.set(n.id, new Set());

	for (const n of dagNodes) {
		for (const d of n.dependsOn) {
			if (ids.has(d)) incoming.get(n.id)?.add(d);
		}
	}

	const level = new Map<string, number>();

	function getLevel(id: string): number {
		const cached = level.get(id);
		if (cached !== undefined) return cached;
		const preds = incoming.get(id);
		if (!preds || preds.size === 0) {
			level.set(id, 0);
			return 0;
		}
		let max = 0;
		for (const p of preds) {
			max = Math.max(max, getLevel(p) + 1);
		}
		level.set(id, max);
		return max;
	}

	for (const n of dagNodes) getLevel(n.id);
	return level;
}

export function dagNodesToReactFlow(dagNodes: DAGNode[]): {
	nodes: Node[];
	edges: Edge[];
} {
	const byLevel = new Map<number, string[]>();
	const layers = computeLayers(dagNodes);

	for (const n of dagNodes) {
		const L = layers.get(n.id) ?? 0;
		if (!byLevel.has(L)) byLevel.set(L, []);
		byLevel.get(L)?.push(n.id);
	}

	const maxL = byLevel.size === 0 ? 0 : Math.max(...Array.from(byLevel.keys()));

	const positions = new Map<string, { x: number; y: number }>();

	for (let L = 0; L <= maxL; L++) {
		const row = (byLevel.get(L) ?? []).slice().sort();
		const width = Math.max(0, (row.length - 1) * NODE_GAP_X);
		row.forEach((id, i) => {
			positions.set(id, {
				x: i * NODE_GAP_X - width / 2,
				y: L * LAYER_GAP_Y,
			});
		});
	}

	const nodes: Node[] = dagNodes.map((n) => ({
		id: n.id,
		type: "action",
		position: positions.get(n.id) ?? { x: 0, y: 0 },
		data: {
			label: n.label,
			handler: n.handler,
			config: n.config,
		} satisfies RFNodeData,
	}));

	const edges: Edge[] = dagNodes.flatMap((n) =>
		n.dependsOn.map((dep) => ({
			id: `${dep}-${n.id}`,
			source: dep,
			target: n.id,
			animated: true,
		})),
	);

	return { nodes, edges };
}

export function parseDagJson(json: unknown): DAGNode[] | null {
	if (!isRecord(json)) return null;
	const rawNodes = json.nodes;
	if (!Array.isArray(rawNodes)) return null;
	const out: DAGNode[] = [];
	for (const item of rawNodes) {
		if (!isRecord(item)) return null;
		const id = item.id;
		const label = item.label;
		const handler = item.handler;
		const dependsOn = item.dependsOn;
		if (
			typeof id !== "string" ||
			typeof label !== "string" ||
			typeof handler !== "string"
		) {
			return null;
		}
		if (
			!Array.isArray(dependsOn) ||
			!dependsOn.every((x) => typeof x === "string")
		) {
			return null;
		}
		const config = item.config;
		out.push({
			id,
			label,
			handler,
			dependsOn: dependsOn as string[],
			config: isRecord(config) ? config : undefined,
		});
	}
	return out;
}

export function validateDagInMemory(
	dag: DAGNode[],
): WorkflowValidationError | null {
	const idSet = new Set(dag.map((n) => n.id));
	if (idSet.size !== dag.length) {
		return { code: "INVALID_NODE", message: "Duplicate node ids" };
	}

	const edges: { source: string; target: string }[] = [];
	for (const n of dag) {
		for (const d of n.dependsOn) {
			if (!idSet.has(d)) {
				return {
					code: "INVALID_EDGE",
					message: `Node "${n.id}" depends on unknown id "${d}"`,
				};
			}
			edges.push({ source: d, target: n.id });
		}
	}

	if (hasDirectedCycle(idSet, edges)) {
		return {
			code: "CYCLE_DETECTED",
			message: "Workflow graph contains a cycle",
		};
	}

	for (const n of dag) {
		if (!HANDLER_SET.has(n.handler)) {
			return {
				code: "UNKNOWN_HANDLER",
				message: `Unknown step handler: ${n.handler}`,
			};
		}
	}

	return null;
}
