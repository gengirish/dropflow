export async function enqueueWorkerJob(
	body: Record<string, unknown>,
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
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `Worker enqueue failed: ${res.status}`);
	}

	const json = (await res.json()) as { jobId?: string };
	return json;
}

export async function seedDefaultNotificationTemplatesOnWorker(
	tenantId: string,
): Promise<void> {
	const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
	const workerSecret =
		process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

	const res = await fetch(
		`${workerUrl}/internal/seed-default-notification-templates`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-worker-secret": workerSecret,
			},
			body: JSON.stringify({ tenantId }),
		},
	);

	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `Seed templates failed: ${res.status}`);
	}
}
