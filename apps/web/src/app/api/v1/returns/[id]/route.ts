import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { enqueueReturnsJob } from "@/lib/returns-worker";
import { prisma } from "@dropflow/db";
import { UpdateReturnStatusInput } from "@dropflow/types";
import type { NextRequest } from "next/server";
import { z } from "zod";

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await params;

		const ret = await prisma.returnRequest.findFirst({
			where: { id, tenantId },
			include: {
				order: true,
				items: true,
				refund: true,
			},
		});

		if (!ret) {
			return err("NOT_FOUND", "Return not found", 404);
		}

		const productIds = [...new Set(ret.items.map((i) => i.productId))];
		const products = await prisma.product.findMany({
			where: { tenantId, id: { in: productIds } },
			select: { id: true, name: true, sku: true },
		});
		const productById = Object.fromEntries(products.map((p) => [p.id, p]));

		return ok({
			...ret,
			items: ret.items.map((i) => ({
				...i,
				product: productById[i.productId] ?? null,
			})),
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("RETURN_FETCH_FAILED", msg, 500);
	}
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await params;
		const input = UpdateReturnStatusInput.parse(await req.json());

		const existing = await prisma.returnRequest.findFirst({
			where: { id, tenantId },
			select: { id: true, status: true },
		});

		if (!existing) {
			return err("NOT_FOUND", "Return not found", 404);
		}

		if (input.status === "APPROVED") {
			const { jobId } = await enqueueReturnsJob("process-return", {
				tenantId,
				returnRequestId: id,
			});
			return ok(
				{
					enqueued: true,
					jobName: "process-return",
					jobId,
					returnRequestId: id,
				},
				202,
			);
		}

		if (input.status === "QC_PASSED") {
			const { jobId } = await enqueueReturnsJob("process-qc", {
				tenantId,
				returnRequestId: id,
				passed: true,
				notes: input.qcNotes,
			});
			return ok(
				{ enqueued: true, jobName: "process-qc", jobId, returnRequestId: id },
				202,
			);
		}

		if (input.status === "QC_FAILED") {
			const { jobId } = await enqueueReturnsJob("process-qc", {
				tenantId,
				returnRequestId: id,
				passed: false,
				notes: input.qcNotes,
			});
			return ok(
				{ enqueued: true, jobName: "process-qc", jobId, returnRequestId: id },
				202,
			);
		}

		const data: {
			status: typeof input.status;
			returnAwbNumber?: string;
			returnCarrier?: string;
			qcNotes?: string;
		} = { status: input.status };

		if (input.returnAwbNumber !== undefined) {
			data.returnAwbNumber = input.returnAwbNumber;
		}
		if (input.returnCarrier !== undefined) {
			data.returnCarrier = input.returnCarrier;
		}
		if (input.qcNotes !== undefined) {
			data.qcNotes = input.qcNotes;
		}

		const updated = await prisma.returnRequest.update({
			where: { id },
			data,
			include: {
				order: { select: { id: true, orderNumber: true, status: true } },
				items: true,
				refund: true,
			},
		});

		return ok(updated);
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
		return err("RETURN_UPDATE_FAILED", msg, 400);
	}
}
