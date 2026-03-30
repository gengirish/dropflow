import { z } from "zod";

export const IndianPhone = z
  .string()
  .regex(/^\+91\d{10}$/, "Must be +91 followed by 10 digits");

export const GSTIN = z
  .string()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    "Invalid GSTIN format"
  );

export const PINCode = z
  .string()
  .regex(/^\d{6}$/, "Must be 6-digit PIN code");

export const MoneyPaise = z.number().int().nonnegative();

export const AddressSchema = z.object({
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional().default(""),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pin: PINCode,
  country: z.string().default("IN"),
});
export type Address = z.infer<typeof AddressSchema>;

export const MoneyResponse = z.object({
  amountPaise: z.number().int(),
  amountFormatted: z.string(),
});
export type MoneyResponse = z.infer<typeof MoneyResponse>;

export const PaginationInput = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type PaginationInput = z.infer<typeof PaginationInput>;

export const PaginatedResponse = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasMore: z.boolean(),
  });

export const ApiSuccessResponse = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorResponse = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
