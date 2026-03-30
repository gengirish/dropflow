---
name: novu-notifications
description: >-
  Novu multi-channel notification infrastructure for DropFlow. Use when
  implementing email, SMS, WhatsApp, or in-app notifications for order updates,
  inventory alerts, or shipment tracking events.
---

# Novu Notifications — DropFlow

Package: `@novu/node`

## Setup

```bash
pnpm add @novu/node --filter worker
```

Self-host Novu via Docker or use Novu Cloud:

```typescript
import { Novu } from "@novu/node";

export const novu = new Novu(env.NOVU_API_KEY);
```

## Notification Workflows

Define workflows in Novu dashboard or via code. DropFlow events:

| Event | Channels | Recipient |
|-------|----------|-----------|
| `order-confirmed` | Email + WhatsApp | Buyer |
| `order-shipped` | Email + WhatsApp + SMS | Buyer |
| `order-delivered` | Email + WhatsApp | Buyer |
| `low-stock-alert` | Email + In-App | Seller (dashboard) |
| `payment-received` | Email | Seller |
| `supplier-po-created` | Email | Supplier |
| `workflow-failed` | SMS + Email | Seller admin |

## Triggering Notifications

```typescript
export async function notifyOrderShipped(order: Order, shipment: Shipment) {
  await novu.trigger("order-shipped", {
    to: {
      subscriberId: order.buyerEmail,
      email: order.buyerEmail,
      phone: order.buyerPhone,
    },
    payload: {
      orderNumber: order.orderNumber,
      trackingUrl: shipment.trackingUrl,
      carrier: shipment.carrier,
      estimatedDelivery: shipment.estimatedDelivery,
    },
  });
}
```

## In DAG Step (dag/steps/send-notification.ts)

```typescript
import { novu } from "../../integrations/novu";

export async function sendNotification(context: WorkflowContext) {
  const { tenantId, triggerId } = context;
  const order = await prisma.order.findUnique({
    where: { id: triggerId },
    include: { shipment: true },
  });

  const event = context.state.notificationEvent as string;

  await novu.trigger(event, {
    to: { subscriberId: order!.buyerEmail, email: order!.buyerEmail, phone: order!.buyerPhone },
    payload: {
      orderNumber: order!.orderNumber,
      status: order!.status,
      trackingUrl: order!.shipment?.trackingUrl,
    },
    overrides: {
      whatsapp: { from: env.TWILIO_WHATSAPP_FROM },
    },
  });

  return { sent: true, event, channel: "multi" };
}
```

## Fallback: Direct Twilio + Resend (without Novu)

If not using Novu, use direct integrations:

```typescript
// WhatsApp via Twilio
import twilio from "twilio";
const twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

await twilioClient.messages.create({
  from: env.TWILIO_WHATSAPP_FROM,
  to: `whatsapp:${buyerPhone}`,
  body: `Your order ${orderNumber} has been shipped! Track: ${trackingUrl}`,
});

// Email via Resend
import { Resend } from "resend";
const resend = new Resend(env.RESEND_API_KEY);

await resend.emails.send({
  from: "DropFlow <orders@dropflow.in>",
  to: buyerEmail,
  subject: `Order ${orderNumber} shipped`,
  react: OrderShippedEmail({ orderNumber, trackingUrl }),
});
```

## Conventions

- Novu is the preferred orchestration layer — handles retries, preferences, digest
- If self-hosting Novu is too complex initially, start with direct Twilio + Resend
- Never log PII (email, phone) in production — redact via Pino
- Buyer notifications: always include order number
- Seller notifications: always include tenant context
- WhatsApp messages must use pre-approved templates in production
