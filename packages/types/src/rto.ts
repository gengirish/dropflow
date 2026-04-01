import { z } from "zod";

export const RtoSignals = z.object({
  addressScore: z.number().min(0).max(100),
  phoneVerified: z.boolean(),
  pinDeliverability: z.number().min(0).max(1),
  isRepeatBuyer: z.boolean(),
  orderValuePaise: z.number().int().nonnegative(),
  paymentMethod: z.enum(["COD", "PREPAID"]),
  pincode: z.string(),
  previousOrders: z.number().int().nonnegative(),
  previousRtos: z.number().int().nonnegative(),
});
export type RtoSignals = z.infer<typeof RtoSignals>;

export const RtoScoreResult = z.object({
  score: z.number().min(0).max(100),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  signals: RtoSignals,
  recommendation: z.enum(["ALLOW", "NUDGE_PREPAID", "FLAG_REVIEW", "BLOCK"]),
});
export type RtoScoreResult = z.infer<typeof RtoScoreResult>;

export const RtoNudgeInput = z.object({
  orderId: z.string().min(1),
  channel: z.enum(["WHATSAPP", "SMS"]).default("WHATSAPP"),
});
export type RtoNudgeInput = z.infer<typeof RtoNudgeInput>;

export const RtoAnalyticsFilters = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  paymentMethod: z.enum(["COD", "PREPAID"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type RtoAnalyticsFilters = z.infer<typeof RtoAnalyticsFilters>;

export const RtoDashboardKPIs = z.object({
  totalOrders: z.number().int(),
  codOrders: z.number().int(),
  prepaidOrders: z.number().int(),
  rtoCount: z.number().int(),
  rtoRate: z.number(),
  codToRtoRate: z.number(),
  nudgesSent: z.number().int(),
  nudgesConverted: z.number().int(),
  nudgeConversionRate: z.number(),
  estimatedSavingsPaise: z.number().int(),
  riskDistribution: z.object({
    low: z.number().int(),
    medium: z.number().int(),
    high: z.number().int(),
    critical: z.number().int(),
  }),
});
export type RtoDashboardKPIs = z.infer<typeof RtoDashboardKPIs>;
