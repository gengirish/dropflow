import type { NextRequest } from "next/server";
import { getAuthTenant } from "@/lib/auth";

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
		const workerSecret = process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

		const response = await fetch(`${workerUrl}/sse/${tenantId}`, {
			headers: { "x-worker-secret": workerSecret },
		});

		if (!response.ok || !response.body) {
			return new Response("SSE connection failed", { status: 502 });
		}

		return new Response(response.body, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	} catch (e) {
		return new Response("SSE proxy error", { status: 500 });
	}
}
