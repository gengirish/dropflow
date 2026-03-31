import type { Job } from "bullmq";
import { QUEUE_NAMES } from "@dropflow/config";
import { createWorker } from "../lib/redis";
import { logger } from "../lib/logger";
import { broadcast } from "../sse/broadcaster";

type OrderLineSummary = {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  lineTotalPaise: number;
};

type OrderConfirmationPayload = {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  totalPaise: number;
  currency: string;
  items: OrderLineSummary[];
};

type ShipmentUpdatePayload = {
  tenantId: string;
  orderId: string;
  orderNumber?: string;
  trackingStatus: string;
  awbNumber?: string | null;
  carrier?: string;
  message?: string;
};

type DeliveryCompletePayload = {
  tenantId: string;
  orderId: string;
  orderNumber?: string;
  deliveredAt?: string;
};

type NotificationJobPayload =
  | OrderConfirmationPayload
  | ShipmentUpdatePayload
  | DeliveryCompletePayload;

function logExternalChannels(): void {
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasTwilio =
    Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()) ||
    Boolean(process.env.TWILIO_AUTH_TOKEN?.trim());
  if (hasResend || hasTwilio) {
    logger.info(
      {
        resendConfigured: hasResend,
        twilioConfigured: hasTwilio,
      },
      "Resend and/or Twilio env vars are set; outbound email/SMS/WhatsApp delivery is not invoked in this worker (in-app SSE only)",
    );
  }
}

function formatPaise(paise: number, currency: string): string {
  const major = paise / 100;
  return `${currency} ${major.toFixed(2)}`;
}

function buildOrderConfirmationTemplates(payload: OrderConfirmationPayload): {
  whatsappTemplate: string;
  emailSubject: string;
  emailBody: string;
} {
  const lines = payload.items
    .map(
      (i) =>
        `  • ${i.name} (${i.sku}) × ${i.quantity} — ${formatPaise(i.lineTotalPaise, payload.currency)}`,
    )
    .join("\n");
  const whatsappTemplate = [
    "Template: order_confirmation_v1",
    `Params: orderNumber=${payload.orderNumber}; buyerName=${payload.buyerName}; total=${formatPaise(payload.totalPaise, payload.currency)}; itemCount=${payload.items.length}`,
  ].join("\n");
  const emailSubject = `Order confirmed — ${payload.orderNumber}`;
  const emailBody = [
    `Hi ${payload.buyerName},`,
    "",
    `Thank you for your order ${payload.orderNumber}.`,
    "",
    "Items:",
    lines,
    "",
    `Total: ${formatPaise(payload.totalPaise, payload.currency)}`,
    "",
    "We will notify you when your order ships.",
  ].join("\n");
  return { whatsappTemplate, emailSubject, emailBody };
}

function buildShipmentUpdateTemplates(
  payload: ShipmentUpdatePayload,
): { whatsappTemplate: string; emailSubject: string; emailBody: string } {
  const whatsappTemplate = [
    "Template: shipment_update_v1",
    `Params: orderNumber=${payload.orderNumber ?? payload.orderId}; status=${payload.trackingStatus}; awb=${payload.awbNumber ?? "n/a"}`,
  ].join("\n");
  const emailSubject = `Shipment update — ${payload.orderNumber ?? payload.orderId}`;
  const emailBody = [
    `Your order ${payload.orderNumber ?? payload.orderId} has a new shipment status.`,
    "",
    `Status: ${payload.trackingStatus}`,
    payload.awbNumber ? `AWB: ${payload.awbNumber}` : "",
    payload.carrier ? `Carrier: ${payload.carrier}` : "",
    payload.message ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  return { whatsappTemplate, emailSubject, emailBody };
}

function buildDeliveryCompleteTemplates(
  payload: DeliveryCompletePayload,
): { whatsappTemplate: string; emailSubject: string; emailBody: string } {
  const whatsappTemplate = [
    "Template: delivery_complete_v1",
    `Params: orderNumber=${payload.orderNumber ?? payload.orderId}; deliveredAt=${payload.deliveredAt ?? "today"}`,
  ].join("\n");
  const emailSubject = `Delivered — ${payload.orderNumber ?? payload.orderId}`;
  const emailBody = [
    `Your order ${payload.orderNumber ?? payload.orderId} has been delivered.`,
    payload.deliveredAt ? `Delivered at: ${payload.deliveredAt}` : "",
    "",
    "Thank you for shopping with us.",
  ]
    .filter(Boolean)
    .join("\n");
  return { whatsappTemplate, emailSubject, emailBody };
}

async function processNotificationJob(job: Job<NotificationJobPayload>) {
  const baseLog = logger.child({ jobId: job.id, notificationType: job.name });

  switch (job.name) {
    case "order-confirmation": {
      const payload = job.data as OrderConfirmationPayload;
      const { whatsappTemplate, emailSubject, emailBody } =
        buildOrderConfirmationTemplates(payload);

      baseLog.info(
        {
          tenantId: payload.tenantId,
          orderId: payload.orderId,
          whatsappTemplate,
          emailSubject,
          emailBody,
        },
        "Notification (order-confirmation): logged WhatsApp template and email body",
      );

      broadcast(payload.tenantId, {
        type: "NOTIFICATION",
        data: {
          channel: "IN_APP",
          kind: "order-confirmation",
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          buyerEmail: payload.buyerEmail,
          title: emailSubject,
          preview: `Total ${formatPaise(payload.totalPaise, payload.currency)} · ${payload.items.length} item(s)`,
        },
      });
      break;
    }
    case "shipment-update": {
      const payload = job.data as ShipmentUpdatePayload;
      const { whatsappTemplate, emailSubject, emailBody } =
        buildShipmentUpdateTemplates(payload);

      baseLog.info(
        {
          tenantId: payload.tenantId,
          orderId: payload.orderId,
          whatsappTemplate,
          emailSubject,
          emailBody,
        },
        "Notification (shipment-update): logged WhatsApp template and email body",
      );

      broadcast(payload.tenantId, {
        type: "NOTIFICATION",
        data: {
          channel: "IN_APP",
          kind: "shipment-update",
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          trackingStatus: payload.trackingStatus,
          awbNumber: payload.awbNumber,
          title: emailSubject,
          preview: payload.trackingStatus,
        },
      });
      break;
    }
    case "delivery-complete": {
      const payload = job.data as DeliveryCompletePayload;
      const { whatsappTemplate, emailSubject, emailBody } =
        buildDeliveryCompleteTemplates(payload);

      baseLog.info(
        {
          tenantId: payload.tenantId,
          orderId: payload.orderId,
          whatsappTemplate,
          emailSubject,
          emailBody,
        },
        "Notification (delivery-complete): logged WhatsApp template and email body",
      );

      broadcast(payload.tenantId, {
        type: "NOTIFICATION",
        data: {
          channel: "IN_APP",
          kind: "delivery-complete",
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          title: emailSubject,
          preview: payload.deliveredAt ?? "Delivered",
        },
      });
      break;
    }
    default:
      throw new Error(`Unknown notification job name: ${job.name}`);
  }
}

export function startNotificationWorker() {
  logExternalChannels();

  const worker = createWorker<NotificationJobPayload>(
    QUEUE_NAMES.NOTIFICATION,
    processNotificationJob,
    { concurrency: 10 },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Notification job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      "Notification job failed",
    );
  });

  logger.info("Notification worker started");
  return worker;
}
