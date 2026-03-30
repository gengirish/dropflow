import { z } from "zod";

export const CreateShipmentInput = z.object({
  orderId: z.string().min(1),
  carrier: z.enum([
    "SHIPROCKET", "DELHIVERY", "DTDC", "BLUEDART",
    "EASYPOST_DHL", "EASYPOST_FEDEX", "EASYPOST_UPS", "SELF",
  ]),
  weightGrams: z.number().int().positive(),
  dimensions: z.object({
    lengthCm: z.number().positive(),
    widthCm: z.number().positive(),
    heightCm: z.number().positive(),
  }).optional(),
  isInternational: z.boolean().default(false),
  customsDeclaration: z.object({
    hsCode: z.string(),
    declaredValue: z.number().int().positive(),
    currency: z.string(),
    description: z.string(),
  }).optional(),
});
export type CreateShipmentInput = z.infer<typeof CreateShipmentInput>;

export const ShipmentFilters = z.object({
  orderId: z.string().optional(),
  carrier: z.string().optional(),
  status: z.string().optional(),
  isInternational: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ShipmentFilters = z.infer<typeof ShipmentFilters>;
