import { z } from "zod";

export const ImportSettlementInput = z.object({
  gateway: z.enum(["RAZORPAY", "STRIPE"]),
  settlementId: z.string().min(1),
  settlementDate: z.string(),
  totalAmountPaise: z.number().int(),
  feePaise: z.number().int().default(0),
  taxOnFeePaise: z.number().int().default(0),
  netAmountPaise: z.number().int(),
  utrNumber: z.string().optional(),
  bankReference: z.string().optional(),
  items: z.array(z.object({
    gatewayPaymentId: z.string().min(1),
    orderId: z.string().optional(),
    amountPaise: z.number().int(),
    feePaise: z.number().int().default(0),
    taxPaise: z.number().int().default(0),
    netPaise: z.number().int(),
  })).min(1),
});
export type ImportSettlementInput = z.infer<typeof ImportSettlementInput>;

export const ImportCodRemittanceInput = z.object({
  carrier: z.enum([
    "SHIPROCKET", "DELHIVERY", "DTDC", "BLUEDART", "ECOM_EXPRESS", "XPRESSBEES",
    "EASYPOST_DHL", "EASYPOST_FEDEX", "EASYPOST_UPS", "SELF",
  ]),
  remittanceId: z.string().min(1),
  remittanceDate: z.string(),
  totalAmountPaise: z.number().int(),
  deductionsPaise: z.number().int().default(0),
  netAmountPaise: z.number().int(),
  utrNumber: z.string().optional(),
  bankReference: z.string().optional(),
  items: z.array(z.object({
    awbNumber: z.string().min(1),
    orderId: z.string().optional(),
    amountPaise: z.number().int(),
    codChargePaise: z.number().int().default(0),
    netPaise: z.number().int(),
  })).min(1),
});
export type ImportCodRemittanceInput = z.infer<typeof ImportCodRemittanceInput>;

export const ReconciliationFilters = z.object({
  type: z.enum(["PAYMENT_GATEWAY", "COD_CARRIER", "SUPPLIER_INVOICE"]).optional(),
  status: z.enum(["MATCHED", "UNMATCHED", "DISCREPANCY", "MANUAL_OVERRIDE"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ReconciliationFilters = z.infer<typeof ReconciliationFilters>;

export const ReconciliationDashboardKPIs = z.object({
  totalRecords: z.number().int(),
  matchedCount: z.number().int(),
  unmatchedCount: z.number().int(),
  discrepancyCount: z.number().int(),
  matchRate: z.number(),
  totalExpectedPaise: z.number().int(),
  totalActualPaise: z.number().int(),
  totalDifferencePaise: z.number().int(),
  byType: z.array(z.object({
    type: z.string(),
    total: z.number().int(),
    matched: z.number().int(),
    unmatched: z.number().int(),
    discrepancy: z.number().int(),
  })),
});
export type ReconciliationDashboardKPIs = z.infer<typeof ReconciliationDashboardKPIs>;

export const ManualMatchInput = z.object({
  recordId: z.string().min(1),
  matchedId: z.string().min(1),
  notes: z.string().optional(),
});
export type ManualMatchInput = z.infer<typeof ManualMatchInput>;
