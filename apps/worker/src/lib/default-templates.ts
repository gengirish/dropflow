import { NOTIFICATION_TRIGGERS } from "@dropflow/config";
import { prisma } from "@dropflow/db";

const WHATSAPP_DEFAULTS: { triggerEvent: string; name: string; templateBody: string }[] = [
  {
    triggerEvent: NOTIFICATION_TRIGGERS.ORDER_CONFIRMED,
    name: "Order confirmed (default)",
    templateBody:
      "Hi {{buyerName}}! Your order {{orderNumber}} has been confirmed. Total: ₹{{totalAmount}}. Track at {{trackingUrl}}",
  },
  {
    triggerEvent: NOTIFICATION_TRIGGERS.ORDER_SHIPPED,
    name: "Order shipped (default)",
    templateBody:
      "Your order {{orderNumber}} has been shipped via {{carrier}}! Track: {{trackingUrl}}",
  },
  {
    triggerEvent: NOTIFICATION_TRIGGERS.ORDER_OUT_FOR_DELIVERY,
    name: "Out for delivery (default)",
    templateBody: "Your order {{orderNumber}} is out for delivery! Expected today.",
  },
  {
    triggerEvent: NOTIFICATION_TRIGGERS.ORDER_DELIVERED,
    name: "Delivered (default)",
    templateBody:
      "Your order {{orderNumber}} has been delivered! Thank you for shopping with us.",
  },
  {
    triggerEvent: NOTIFICATION_TRIGGERS.COD_TO_PREPAID_NUDGE,
    name: "COD to prepaid nudge (default)",
    templateBody:
      "Hi {{buyerName}}, pay online for order {{orderNumber}} and get ₹{{discount}} off! Pay here: {{paymentLink}}",
  },
];

export async function seedDefaultTemplates(tenantId: string): Promise<void> {
  for (const row of WHATSAPP_DEFAULTS) {
    await prisma.notificationTemplate.upsert({
      where: {
        tenantId_channel_triggerEvent: {
          tenantId,
          channel: "WHATSAPP",
          triggerEvent: row.triggerEvent,
        },
      },
      create: {
        tenantId,
        channel: "WHATSAPP",
        triggerEvent: row.triggerEvent,
        name: row.name,
        templateBody: row.templateBody,
        variables: [],
        isActive: true,
      },
      update: {
        name: row.name,
        templateBody: row.templateBody,
        isActive: true,
      },
    });
  }
}

export function defaultTemplateBodyForTrigger(triggerEvent: string): string | null {
  const row = WHATSAPP_DEFAULTS.find((r) => r.triggerEvent === triggerEvent);
  return row?.templateBody ?? null;
}
