import { z } from "zod";
import { GSTIN } from "./common";

export const CreateTenantInput = z.object({
  clerkOrgId: z.string().min(1),
  slug: z.string().min(2).max(63).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1),
  gstin: GSTIN.optional(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional(),
  sellerStateCode: z.string().length(2).optional(),
});
export type CreateTenantInput = z.infer<typeof CreateTenantInput>;

export const CreateSupplierInput = z.object({
  name: z.string().min(1),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  gstin: GSTIN.optional(),
  leadTimeDays: z.number().int().positive().default(3),
  returnWindowDays: z.number().int().nonnegative().default(7),
});
export type CreateSupplierInput = z.infer<typeof CreateSupplierInput>;
