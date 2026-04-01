import { z } from "zod";

export const MarginWaterfallItem = z.object({
  label: z.string(),
  amountPaise: z.number().int(),
  percent: z.number(),
  type: z.enum(["revenue", "cost", "net"]),
});
export type MarginWaterfallItem = z.infer<typeof MarginWaterfallItem>;

export const OrderMarginResponse = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  sellingPricePaise: z.number().int(),
  costPricePaise: z.number().int(),
  gstPaise: z.number().int(),
  shippingCostPaise: z.number().int(),
  gatewayFeePaise: z.number().int(),
  packagingCostPaise: z.number().int(),
  returnReservePaise: z.number().int(),
  discountPaise: z.number().int(),
  otherCostsPaise: z.number().int(),
  netMarginPaise: z.number().int(),
  marginPercent: z.number(),
  waterfall: z.array(MarginWaterfallItem),
});
export type OrderMarginResponse = z.infer<typeof OrderMarginResponse>;

export const MarginFilters = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  productId: z.string().optional(),
  supplierId: z.string().optional(),
  sortBy: z.enum(["margin", "revenue", "orders"]).default("margin"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type MarginFilters = z.infer<typeof MarginFilters>;

export const MarginDashboardKPIs = z.object({
  avgMarginPercent: z.number(),
  totalRevenuePaise: z.number().int(),
  totalCostPaise: z.number().int(),
  totalProfitPaise: z.number().int(),
  avgOrderMarginPaise: z.number().int(),
  totalShippingPaise: z.number().int(),
  totalGatewayFeesPaise: z.number().int(),
  totalGstPaise: z.number().int(),
  totalReturnCostPaise: z.number().int(),
  topMarginProducts: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    sku: z.string(),
    marginPercent: z.number(),
    netProfitPaise: z.number().int(),
  })),
  worstMarginProducts: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    sku: z.string(),
    marginPercent: z.number(),
    netProfitPaise: z.number().int(),
  })),
});
export type MarginDashboardKPIs = z.infer<typeof MarginDashboardKPIs>;
