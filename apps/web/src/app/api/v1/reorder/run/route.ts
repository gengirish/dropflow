import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

export async function POST() {
  try {
    const { tenantId } = await getAuthTenant();

    const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
    const workerSecret = process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

    const res = await fetch(`${workerUrl}/internal/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": workerSecret,
      },
      body: JSON.stringify({
        queue: "reorder-queue",
        jobName: "compute-velocity-and-check",
        payload: { tenantId },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return err("REORDER_ENQUEUE_FAILED", text || "Worker enqueue failed", 502);
    }

    const json = (await res.json()) as { jobId?: string };
    return ok({ jobId: json.jobId ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (
      msg === "Unauthorized" ||
      msg === "No organization selected" ||
      msg === "Tenant not found"
    ) {
      return err("UNAUTHORIZED", msg, 401);
    }
    return err("REORDER_RUN_FAILED", msg, 500);
  }
}
