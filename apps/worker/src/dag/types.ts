export interface WorkflowContext {
  tenantId: string;
  orderId: string;
  workflowRunId: string;
  triggerId: string;
  data: Record<string, unknown>;
}

export interface StepResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export type StepFunction = (ctx: WorkflowContext) => Promise<StepResult>;

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
