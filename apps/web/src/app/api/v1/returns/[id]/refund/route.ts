import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { enqueueReturnsJob } from "@/lib/returns-worker";
import { prisma } from "@dropflow/db";
import { InitiateRefundInput } from "@dropflow/types";
import type { NextRequest } from "next/server";
import { z } from "zod";

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await params;
		const json = await req.json();
		const input = InitiateRefundInput.parse({ ...json, returnRequestId: id });

		if (input.returnRequestId !== id) {
			return err("ID_MISMATCH", "returnRequestId must match URL", 400);
		}

		const ret = await prisma.returnRequest.findFirst({
			where: { id, tenantId },
			include: { refund: true },
		});

		if (!ret) {
			return err("NOT_FOUND", "Return not found", 404);
		}

		if (ret.status !== "QC_PASSED") {
			return err(
				"INVALID_STATUS",
				"Refund can only be initiated after QC passes",
				400,
			);
		}

		if (ret.refund?.status === "COMPLETED") {
			return err(
				"REFUND_EXISTS",
				"Refund already completed for this return",
				400,
			);
		}

		const { jobId } = await enqueueReturnsJob("process-refund", {
			tenantId,
			returnRequestId: id,
			method: input.method,
			amountPaise: input.amountPaise,
		});

		return ok(
			{ enqueued: true, jobName: "process-refund", jobId, returnRequestId: id },
			202,
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		if (e instanceof z.ZodError) {
			return err("VALIDATION_ERROR", e.message, 400);
		}
		return err("REFUND_ENQUEUE_FAILED", msg, 400);
	}
}
