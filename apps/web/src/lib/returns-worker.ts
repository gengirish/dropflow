export async function enqueueReturnsJob(
	jobName: "process-return" | "process-qc" | "process-refund",
	payload: Record<string, unknown>,
): Promise<{ jobId?: string }> {
	const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
	const workerSecret =
		process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

	const res = await fetch(`${workerUrl}/internal/enqueue`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-worker-secret": workerSecret,
		},
		body: JSON.stringify({
			queue: "returns-queue",
			jobName,
			payload,
		}),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `Enqueue failed: ${res.status}`);
	}

	return res.json() as Promise<{ jobId?: string }>;
}
