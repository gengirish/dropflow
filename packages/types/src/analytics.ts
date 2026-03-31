import { z } from "zod";

export const AnalyticsDateRange = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("DAILY"),
});
export type AnalyticsDateRange = z.infer<typeof AnalyticsDateRange>;

export const SkuEconomicsFilters = z.object({
  period: z.string().optional(),
  sortBy: z.enum(["margin", "revenue", "units", "profit"]).default("revenue"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type SkuEconomicsFilters = z.infer<typeof SkuEconomicsFilters>;

export const SkuEconomicsItem = z.object({
  productId: z.string(),
  productName: z.string(),
  sku: z.string(),
  unitsSold: z.number().int(),
  unitsReturned: z.number().int(),
  revenuePaise: z.number().int(),
  cogsPaise: z.number().int(),
  gstPaise: z.number().int(),
  shippingPaise: z.number().int(),
  gatewayFeePaise: z.number().int(),
  returnCostPaise: z.number().int(),
  netProfitPaise: z.number().int(),
  marginPercent: z.number(),
});
export type SkuEconomicsItem = z.infer<typeof SkuEconomicsItem>;

export const DashboardKPIs = z.object({
  totalRevenuePaise: z.number().int(),
  totalProfitPaise: z.number().int(),
  avgMarginPercent: z.number(),
  totalOrders: z.number().int(),
  returnRate: z.number(),
  avgOrderValuePaise: z.number().int(),
  revenueGrowthPercent: z.number(),
  topSkus: z.array(SkuEconomicsItem),
  worstSkus: z.array(SkuEconomicsItem),
});
export type DashboardKPIs = z.infer<typeof DashboardKPIs>;

export const RevenueDataPoint = z.object({
  date: z.string(),
  revenuePaise: z.number().int(),
  profitPaise: z.number().int(),
  orderCount: z.number().int(),
  cogsPaise: z.number().int(),
});
export type RevenueDataPoint = z.infer<typeof RevenueDataPoint>;

export const WorkflowNodeInput = z.object({
  id: z.string(),
  type: z.enum(["action", "condition", "delay", "webhook", "approval"]),
  handler: z.string(),
  label: z.string(),
  config: z.record(z.unknown()).default({}),
  position: z.object({ x: z.number(), y: z.number() }),
});
export type WorkflowNodeInput = z.infer<typeof WorkflowNodeInput>;

export const WorkflowEdgeInput = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  condition: z.string().optional(),
});
export type WorkflowEdgeInput = z.infer<typeof WorkflowEdgeInput>;

export const SaveWorkflowInput = z.object({
  name: z.string().min(1),
  trigger: z.string().default("order.created"),
  nodes: z.array(WorkflowNodeInput).min(1),
  edges: z.array(WorkflowEdgeInput),
});
export type SaveWorkflowInput = z.infer<typeof SaveWorkflowInput>;
