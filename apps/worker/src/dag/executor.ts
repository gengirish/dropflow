import { prisma, Prisma } from "@dropflow/db";
import { broadcast } from "../sse/broadcaster";
import { logger } from "../lib/logger";
import { getStepHandler } from "./step-registry";
import type { WorkflowContext, DAGDefinition, DAGNode, StepResult } from "./types";

function topologicalSort(nodes: DAGNode[]): DAGNode[] {
  const sorted: DAGNode[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    if (temp.has(nodeId)) throw new Error(`Cycle detected at node: ${nodeId}`);

    temp.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    for (const dep of node.dependsOn) {
      visit(dep);
    }

    temp.delete(nodeId);
    visited.add(nodeId);
    sorted.push(node);
  }

  for (const node of nodes) {
    visit(node.id);
  }

  return sorted;
}

export async function executeWorkflow(
  dag: DAGDefinition,
  ctx: WorkflowContext,
): Promise<{ success: boolean; failedStep?: string; error?: string }> {
  const log = logger.child({
    tenantId: ctx.tenantId,
    orderId: ctx.orderId,
    workflowRunId: ctx.workflowRunId,
  });

  let sortedNodes: DAGNode[];
  try {
    sortedNodes = topologicalSort(dag.nodes);
  } catch (e) {
    const error = e instanceof Error ? e.message : "Invalid DAG";
    log.error({ error }, "DAG validation failed");
    return { success: false, error };
  }

  log.info({ steps: sortedNodes.map((n) => n.id) }, "Workflow execution started");

  broadcast(ctx.tenantId, {
    type: "WORKFLOW_STARTED",
    workflowRunId: ctx.workflowRunId,
    data: { orderId: ctx.orderId, steps: sortedNodes.map((n) => n.id) },
  });

  const stepResults = new Map<string, StepResult>();

  for (const node of sortedNodes) {
    await prisma.workflowRun.update({
      where: { id: ctx.workflowRunId },
      data: { currentStep: node.id },
    });

    broadcast(ctx.tenantId, {
      type: "WORKFLOW_STEP",
      workflowRunId: ctx.workflowRunId,
      step: node.id,
      status: "running",
    });

    const handler = getStepHandler(node.handler);
    if (!handler) {
      const error = `No handler found for step: ${node.handler}`;
      log.error({ step: node.id }, error);

      broadcast(ctx.tenantId, {
        type: "WORKFLOW_STEP",
        workflowRunId: ctx.workflowRunId,
        step: node.id,
        status: "failed",
        data: { error },
      });

      await prisma.workflowRun.update({
        where: { id: ctx.workflowRunId },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: error,
        },
      });

      return { success: false, failedStep: node.id, error };
    }

    try {
      const mergedCtx: WorkflowContext = {
        ...ctx,
        data: { ...ctx.data },
      };

      for (const [, result] of stepResults) {
        if (result.data) {
          Object.assign(mergedCtx.data, result.data);
        }
      }

      log.info({ step: node.id }, "Executing step");
      const result = await handler(mergedCtx);
      stepResults.set(node.id, result);

      const auditEntry: Prisma.InputJsonValue = {
        step: node.id,
        status: result.success ? "completed" : "failed",
        timestamp: new Date().toISOString(),
        ...(result.data !== undefined && {
          data: result.data as Prisma.InputJsonValue,
        }),
        ...(result.error !== undefined && { error: result.error }),
      };

      await prisma.workflowRun.update({
        where: { id: ctx.workflowRunId },
        data: {
          auditLog: { push: auditEntry },
        },
      });

      if (!result.success) {
        log.error({ step: node.id, error: result.error }, "Step failed");

        broadcast(ctx.tenantId, {
          type: "WORKFLOW_STEP",
          workflowRunId: ctx.workflowRunId,
          step: node.id,
          status: "failed",
          data: { error: result.error },
        });

        await prisma.workflowRun.update({
          where: { id: ctx.workflowRunId },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            errorMessage: result.error,
          },
        });

        broadcast(ctx.tenantId, {
          type: "WORKFLOW_FAILED",
          workflowRunId: ctx.workflowRunId,
          data: { failedStep: node.id, error: result.error },
        });

        return { success: false, failedStep: node.id, error: result.error };
      }

      log.info({ step: node.id, data: result.data }, "Step completed");

      broadcast(ctx.tenantId, {
        type: "WORKFLOW_STEP",
        workflowRunId: ctx.workflowRunId,
        step: node.id,
        status: "completed",
        data: result.data,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown error";
      log.error({ step: node.id, error }, "Step threw an exception");

      broadcast(ctx.tenantId, {
        type: "WORKFLOW_STEP",
        workflowRunId: ctx.workflowRunId,
        step: node.id,
        status: "failed",
        data: { error },
      });

      await prisma.workflowRun.update({
        where: { id: ctx.workflowRunId },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: error,
        },
      });

      return { success: false, failedStep: node.id, error };
    }
  }

  await prisma.workflowRun.update({
    where: { id: ctx.workflowRunId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      currentStep: null,
    },
  });

  broadcast(ctx.tenantId, {
    type: "WORKFLOW_COMPLETED",
    workflowRunId: ctx.workflowRunId,
    data: { orderId: ctx.orderId },
  });

  log.info("Workflow completed successfully");
  return { success: true };
}
