import { z } from "zod";
import { MoneyPaise } from "./common";

export const CreateProductInput = z.object({
  supplierId: z.string().min(1),
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  hsnCode: z.string().min(4, "HSN code must be at least 4 digits"),
  costPricePaise: MoneyPaise,
  sellingPricePaise: MoneyPaise,
  gstRatePercent: z.number().int().refine((v) => [0, 3, 5, 12, 18, 28].includes(v), {
    message: "GST rate must be 0, 3, 5, 12, 18, or 28",
  }),
  stockQty: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(10),
  images: z.array(z.string().url()).optional().default([]),
});
export type CreateProductInput = z.infer<typeof CreateProductInput>;

export const UpdateProductInput = CreateProductInput.partial().omit({ supplierId: true, sku: true });
export type UpdateProductInput = z.infer<typeof UpdateProductInput>;

export const UpdateInventoryInput = z.object({
  stockQty: z.number().int().nonnegative().optional(),
  delta: z.number().int().optional(),
  reason: z.string().min(1, "Reason is required"),
});
export type UpdateInventoryInput = z.infer<typeof UpdateInventoryInput>;

export const ProductFilters = z.object({
  supplierId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  isListed: z.coerce.boolean().optional(),
  lowStock: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ProductFilters = z.infer<typeof ProductFilters>;
