import { z } from "zod";
import { AddressSchema, MoneyPaise, IndianPhone } from "./common";

export const OrderItemInput = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});
export type OrderItemInput = z.infer<typeof OrderItemInput>;

export const CreateOrderInput = z.object({
  buyerName: z.string().min(1, "Buyer name is required"),
  buyerEmail: z.string().email("Invalid email"),
  buyerPhone: IndianPhone,
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema,
  items: z.array(OrderItemInput).min(1, "At least one item required"),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]).default("INR"),
  paymentMethod: z.enum(["COD", "PREPAID"]).default("PREPAID"),
  channelId: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

export const UpdateOrderStatusInput = z.object({
  status: z.enum([
    "PENDING", "PAYMENT_PENDING", "PAYMENT_CONFIRMED", "ROUTING",
    "PO_CREATED", "SUPPLIER_CONFIRMED", "PROCESSING", "SHIPPED",
    "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURN_REQUESTED",
    "RETURNED", "REFUNDED",
  ]),
  note: z.string().optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusInput>;

export const OrderFilters = z.object({
  status: z.string().optional(),
  supplierId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type OrderFilters = z.infer<typeof OrderFilters>;
