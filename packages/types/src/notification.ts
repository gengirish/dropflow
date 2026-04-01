import { z } from "zod";

export const CreateNotificationTemplateInput = z.object({
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS", "IN_APP"]),
  triggerEvent: z.string().min(1),
  name: z.string().min(1),
  templateId: z.string().optional(),
  templateBody: z.string().min(1),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});
export type CreateNotificationTemplateInput = z.infer<typeof CreateNotificationTemplateInput>;

export const UpdateNotificationTemplateInput = CreateNotificationTemplateInput.partial();
export type UpdateNotificationTemplateInput = z.infer<typeof UpdateNotificationTemplateInput>;

export const SendNotificationInput = z.object({
  orderId: z.string().min(1),
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS", "IN_APP"]),
  triggerEvent: z.string().min(1),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  variables: z.record(z.string()).default({}),
});
export type SendNotificationInput = z.infer<typeof SendNotificationInput>;

export const NotificationLogFilters = z.object({
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS", "IN_APP"]).optional(),
  status: z.string().optional(),
  orderId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type NotificationLogFilters = z.infer<typeof NotificationLogFilters>;

export const WhatsAppConfig = z.object({
  provider: z.enum(["GUPSHUP", "INTERAKT", "WATI"]),
  apiKey: z.string().min(1),
  apiUrl: z.string().url(),
  phoneNumberId: z.string().optional(),
  businessAccountId: z.string().optional(),
});
export type WhatsAppConfig = z.infer<typeof WhatsAppConfig>;
