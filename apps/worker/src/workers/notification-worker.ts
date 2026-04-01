import type { Job } from "bullmq";
import { prisma, type NotificationChannel } from "@dropflow/db";
import { QUEUE_NAMES } from "@dropflow/config";
import { createWorker } from "../lib/redis";
import { logger } from "../lib/logger";
import { broadcast } from "../sse/broadcaster";
import { defaultTemplateBodyForTrigger } from "../lib/default-templates";

export type NotificationJobPayload = {
  tenantId: string;
  orderId: string;
  channel: NotificationChannel;
  triggerEvent: string;
  recipientPhone?: string;
  recipientEmail?: string;
  variables?: Record<string, string>;
};

const ALLOWED_JOB_NAMES = new Set([
  "order-confirmation",
  "shipment-update",
  "delivery-complete",
  "cod-nudge",
  "return-update",
  "refund-update",
  "generic",
]);

function renderTemplateBody(
  templateBody: string,
  variables: Record<string, string>,
): string {
  return templateBody.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return variables[key] ?? "";
  });
}

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
      "Resend and/or Twilio env vars are set; outbound email/SMS/WhatsApp delivery is mocked in this worker",
    );
  }
}

async function processNotificationJob(job: Job<NotificationJobPayload>) {
  if (!ALLOWED_JOB_NAMES.has(job.name)) {
    throw new Error(`Unknown notification job name: ${job.name}`);
  }

  const baseLog = logger.child({
    jobId: job.id,
    notificationJobName: job.name,
  });

  const {
    tenantId,
    orderId,
    channel,
    triggerEvent,
    recipientPhone,
    recipientEmail,
    variables = {},
  } = job.data;

  const strVars: Record<string, string> = Object.fromEntries(
    Object.entries(variables).map(([k, v]) => [k, String(v)]),
  );

  const template = await prisma.notificationTemplate.findFirst({
    where: {
      tenantId,
      channel,
      triggerEvent,
      isActive: true,
    },
  });

  const rawBody =
    template?.templateBody ??
    defaultTemplateBodyForTrigger(triggerEvent) ??
    `Notification: ${triggerEvent} for order ${orderId}`;

  const rendered = renderTemplateBody(rawBody, strVars);

  const logRow = await prisma.notificationLog.create({
    data: {
      tenantId,
      orderId,
      channel,
      templateId: template?.id ?? null,
      recipientPhone: recipientPhone ?? null,
      recipientEmail: recipientEmail ?? null,
      status: "QUEUED",
    },
  });

  let deliveryOk = true;
  let errorMessage: string | null = null;

  switch (channel) {
    case "WHATSAPP": {
      if (!recipientPhone?.trim()) {
        deliveryOk = false;
        errorMessage = "Missing recipient phone for WhatsApp";
      } else {
        logger.info(
          `Sending WhatsApp via Gupshup: ${rendered} to ${recipientPhone}`,
        );
      }
      break;
    }
    case "SMS": {
      if (!recipientPhone?.trim()) {
        deliveryOk = false;
        errorMessage = "Missing recipient phone for SMS";
      } else {
        logger.info(`Sending SMS: ${rendered} to ${recipientPhone}`);
      }
      break;
    }
    case "EMAIL": {
      if (!recipientEmail?.trim()) {
        deliveryOk = false;
        errorMessage = "Missing recipient email";
      } else {
        logger.info(`Sending email: ${rendered} to ${recipientEmail}`);
      }
      break;
    }
    case "IN_APP": {
      break;
    }
  }

  await prisma.notificationLog.update({
    where: { id: logRow.id },
    data: {
      status: deliveryOk ? "SENT" : "FAILED",
      sentAt: deliveryOk ? new Date() : null,
      errorMessage,
    },
  });

  broadcast(tenantId, {
    type: "NOTIFICATION",
    data: {
      channel,
      triggerEvent,
      orderId,
      jobName: job.name,
      logId: logRow.id,
      status: deliveryOk ? "SENT" : "FAILED",
      preview: rendered.slice(0, 200),
      recipientPhone: recipientPhone ?? undefined,
      recipientEmail: recipientEmail ?? undefined,
    },
  });

  baseLog.info(
    {
      tenantId,
      orderId,
      channel,
      triggerEvent,
      notificationLogId: logRow.id,
      deliveryOk,
    },
    "Notification processed",
  );
}

export function startNotificationWorker() {
  logExternalChannels();

  const worker = createWorker<NotificationJobPayload>(
    QUEUE_NAMES.NOTIFICATION,
    processNotificationJob,
    { concurrency: 10 },
  );

  worker.on("completed", (j) => {
    logger.info({ jobId: j.id }, "Notification job completed");
  });

  worker.on("failed", (j, error) => {
    logger.error(
      { jobId: j?.id, error: error.message },
      "Notification job failed",
    );
  });

  logger.info("Notification worker started");
  return worker;
}
