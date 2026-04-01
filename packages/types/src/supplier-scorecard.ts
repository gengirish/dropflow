import { z } from "zod";

export const SupplierScorecardResponse = z.object({
  supplierId: z.string(),
  supplierName: z.string(),
  period: z.string(),
  totalPOs: z.number().int(),
  onTimePOs: z.number().int(),
  latePOs: z.number().int(),
  totalUnits: z.number().int(),
  defectiveUnits: z.number().int(),
  returnedUnits: z.number().int(),
  avgLeadTimeDays: z.number(),
  promisedLeadTimeDays: z.number(),
  fulfillmentRate: z.number(),
  defectRate: z.number(),
  returnRate: z.number(),
  overallScore: z.number(),
});
export type SupplierScorecardResponse = z.infer<typeof SupplierScorecardResponse>;

export const SupplierScorecardFilters = z.object({
  supplierId: z.string().optional(),
  period: z.string().optional(),
  minScore: z.coerce.number().optional(),
  maxScore: z.coerce.number().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type SupplierScorecardFilters = z.infer<typeof SupplierScorecardFilters>;

export const CreateIncidentInput = z.object({
  supplierId: z.string().min(1),
  type: z.enum(["LATE_DELIVERY", "DEFECT", "WRONG_ITEM", "SHORT_SHIPMENT", "QUALITY_ISSUE"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  description: z.string().optional(),
  poId: z.string().optional(),
  orderId: z.string().optional(),
});
export type CreateIncidentInput = z.infer<typeof CreateIncidentInput>;

export const SupplierRankingItem = z.object({
  supplierId: z.string(),
  supplierName: z.string(),
  overallScore: z.number(),
  fulfillmentRate: z.number(),
  defectRate: z.number(),
  returnRate: z.number(),
  trend: z.enum(["up", "down", "stable"]),
});
export type SupplierRankingItem = z.infer<typeof SupplierRankingItem>;
