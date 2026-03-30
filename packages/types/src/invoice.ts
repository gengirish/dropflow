import { z } from "zod";

export const GenerateInvoiceInput = z.object({
  orderId: z.string().min(1),
});
export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceInput>;

export const InvoiceFilters = z.object({
  orderId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  gstType: z.enum(["CGST_SGST", "IGST", "EXPORT_LUT", "EXEMPT"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type InvoiceFilters = z.infer<typeof InvoiceFilters>;
