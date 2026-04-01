import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { ImportCodRemittanceInput } from "@dropflow/types";
import type { NextRequest } from "next/server";

function enqueueUrl() {
	const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
	const workerSecret =
		process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";
	return { workerUrl, workerSecret };
}

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const { searchParams } = new URL(req.url);
		const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
		const pageSize = Math.min(
			100,
			Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20),
		);

		const where = { tenantId };

		const [total, rows] = await Promise.all([
			prisma.codRemittance.count({ where }),
			prisma.codRemittance.findMany({
				where,
				orderBy: { remittanceDate: "desc" },
				skip: (page - 1) * pageSize,
				take: pageSize,
				include: {
					items: { select: { isMatched: true } },
				},
			}),
		]);

		const items = rows.map((r) => {
			const matched = r.items.filter((i) => i.isMatched).length;
			return {
				id: r.id,
				carrier: r.carrier,
				remittanceId: r.remittanceId,
				remittanceDate: r.remittanceDate.toISOString(),
				totalAmountPaise: r.totalAmountPaise,
				netAmountPaise: r.netAmountPaise,
				status: r.status,
				itemCount: r.items.length,
				matchedCount: matched,
				unmatchedCount: r.items.length - matched,
			};
		});

		return paginated(items, total, page, pageSize);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("COD_REMITTANCES_LIST_FAILED", msg, 500);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const body = await req.json();
		const input = ImportCodRemittanceInput.parse(body);

		const remittance = await prisma.codRemittance.create({
			data: {
				tenantId,
				carrier: input.carrier,
				remittanceId: input.remittanceId,
				remittanceDate: new Date(input.remittanceDate),
				totalAmountPaise: input.totalAmountPaise,
				deductionsPaise: input.deductionsPaise,
				netAmountPaise: input.netAmountPaise,
				utrNumber: input.utrNumber,
				bankReference: input.bankReference,
				rawJson: input as unknown as object,
				items: {
					create: input.items.map((it) => ({
						tenantId,
						awbNumber: it.awbNumber,
						orderId: it.orderId,
						amountPaise: it.amountPaise,
						codChargePaise: it.codChargePaise,
						netPaise: it.netPaise,
					})),
				},
			},
		});

		const { workerUrl, workerSecret } = enqueueUrl();
		const res = await fetch(`${workerUrl}/internal/enqueue`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-worker-secret": workerSecret,
			},
			body: JSON.stringify({
				queue: "reconciliation-queue",
				jobName: "match-cod-remittance",
				payload: { tenantId, remittanceId: remittance.id },
			}),
		});

		if (!res.ok) {
			const text = await res.text();
			return err(
				"RECONCILIATION_ENQUEUE_FAILED",
				text || "Worker enqueue failed",
				502,
			);
		}

		const json = (await res.json()) as { jobId?: string };
		return ok({ remittanceId: remittance.id, jobId: json.jobId ?? null });
	} catch (e) {
		if (
			e &&
			typeof e === "object" &&
			"code" in e &&
			(e as { code?: string }).code === "P2002"
		) {
			return err(
				"DUPLICATE_REMITTANCE",
				"COD remittance already imported for this carrier",
				409,
			);
		}
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("COD_REMITTANCE_IMPORT_FAILED", msg, 400);
	}
}
