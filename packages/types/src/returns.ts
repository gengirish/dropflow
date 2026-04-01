import { z } from "zod";

export const CreateReturnInput = z.object({
  orderId: z.string().min(1),
  reason: z.enum(["DEFECTIVE", "WRONG_ITEM", "SIZE_ISSUE", "DAMAGED_IN_TRANSIT", "NOT_AS_DESCRIBED", "CHANGED_MIND", "OTHER"]),
  customerNotes: z.string().optional(),
  items: z.array(z.object({
    orderItemId: z.string().min(1),
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    reason: z.enum(["DEFECTIVE", "WRONG_ITEM", "SIZE_ISSUE", "DAMAGED_IN_TRANSIT", "NOT_AS_DESCRIBED", "CHANGED_MIND", "OTHER"]),
  })).min(1),
});
export type CreateReturnInput = z.infer<typeof CreateReturnInput>;

export const UpdateReturnStatusInput = z.object({
  status: z.enum([
    "REQUESTED", "APPROVED", "PICKUP_SCHEDULED", "PICKED_UP", "RECEIVED",
    "QC_PASSED", "QC_FAILED", "RESTOCKED", "DISPOSED",
    "REFUND_INITIATED", "REFUND_COMPLETED", "REJECTED",
  ]),
  qcNotes: z.string().optional(),
  returnAwbNumber: z.string().optional(),
  returnCarrier: z.string().optional(),
});
export type UpdateReturnStatusInput = z.infer<typeof UpdateReturnStatusInput>;

export const InitiateRefundInput = z.object({
  returnRequestId: z.string().min(1),
  method: z.enum(["ORIGINAL_PAYMENT", "STORE_CREDIT", "BANK_TRANSFER"]).default("ORIGINAL_PAYMENT"),
  amountPaise: z.number().int().positive(),
});
export type InitiateRefundInput = z.infer<typeof InitiateRefundInput>;

export const ReturnFilters = z.object({
  status: z.string().optional(),
  reason: z.string().optional(),
  orderId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ReturnFilters = z.infer<typeof ReturnFilters>;

export const ReturnDashboardKPIs = z.object({
  totalReturns: z.number().int(),
  pendingReturns: z.number().int(),
  returnRate: z.number(),
  avgResolutionDays: z.number(),
  totalRefundedPaise: z.number().int(),
  qcPassRate: z.number(),
  restockRate: z.number(),
  topReturnReasons: z.array(z.object({
    reason: z.string(),
    count: z.number().int(),
    percent: z.number(),
  })),
});
export type ReturnDashboardKPIs = z.infer<typeof ReturnDashboardKPIs>;
