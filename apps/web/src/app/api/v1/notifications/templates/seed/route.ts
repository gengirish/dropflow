import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { seedDefaultNotificationTemplatesOnWorker } from "@/lib/worker-fetch";

export async function POST() {
	try {
		const { tenantId } = await getAuthTenant();
		await seedDefaultNotificationTemplatesOnWorker(tenantId);
		return ok({ seeded: true });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("NOTIFICATION_TEMPLATES_SEED_FAILED", msg, 502);
	}
}
