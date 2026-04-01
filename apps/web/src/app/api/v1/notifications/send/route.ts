import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { notificationJobNameForTrigger } from "@/lib/notification-job-name";
import { enqueueWorkerJob } from "@/lib/worker-fetch";
import { SendNotificationInput } from "@dropflow/types";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const body = await req.json();
		const input = SendNotificationInput.parse(body);

		const jobName = notificationJobNameForTrigger(input.triggerEvent);

		const payload = {
			tenantId,
			orderId: input.orderId,
			channel: input.channel,
			triggerEvent: input.triggerEvent,
			...(input.recipientPhone !== undefined
				? { recipientPhone: input.recipientPhone }
				: {}),
			...(input.recipientEmail !== undefined
				? { recipientEmail: input.recipientEmail }
				: {}),
			variables: input.variables,
		};

		const { jobId } = await enqueueWorkerJob({
			queue: "notification-queue",
			jobName,
			payload,
		});

		return ok({ jobId: jobId ?? null });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("NOTIFICATION_SEND_FAILED", msg, 400);
	}
}
