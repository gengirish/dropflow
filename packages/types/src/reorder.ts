import { z } from "zod";

export const CreateReorderRuleInput = z.object({
  productId: z.string().min(1),
  reorderPoint: z.number().int().nonnegative(),
  reorderQty: z.number().int().positive(),
  maxStockQty: z.number().int().nonnegative().default(0),
  leadTimeDays: z.number().int().positive().optional(),
  isAutoPoEnabled: z.boolean().default(false),
});
export type CreateReorderRuleInput = z.infer<typeof CreateReorderRuleInput>;

export const UpdateReorderRuleInput = CreateReorderRuleInput.partial().omit({ productId: true });
export type UpdateReorderRuleInput = z.infer<typeof UpdateReorderRuleInput>;

export const ReorderAlertResponse = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  sku: z.string(),
  currentStock: z.number().int(),
  reorderPoint: z.number().int(),
  daysOfStockRemaining: z.number(),
  suggestedQty: z.number().int(),
  supplierName: z.string().optional(),
  autoPoCreated: z.boolean(),
  purchaseOrderId: z.string().optional(),
  acknowledgedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ReorderAlertResponse = z.infer<typeof ReorderAlertResponse>;

export const ReorderAlertFilters = z.object({
  acknowledged: z.coerce.boolean().optional(),
  autoPoCreated: z.coerce.boolean().optional(),
  urgency: z.enum(["critical", "warning", "normal"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ReorderAlertFilters = z.infer<typeof ReorderAlertFilters>;

export const StockForecast = z.object({
  productId: z.string(),
  productName: z.string(),
  sku: z.string(),
  currentStock: z.number().int(),
  salesVelocityDaily: z.number(),
  daysOfStockRemaining: z.number(),
  reorderPoint: z.number().int(),
  reorderQty: z.number().int(),
  supplierLeadTimeDays: z.number().int(),
  stockoutDate: z.string().nullable(),
  status: z.enum(["OK", "WARNING", "CRITICAL", "STOCKOUT"]),
});
export type StockForecast = z.infer<typeof StockForecast>;
