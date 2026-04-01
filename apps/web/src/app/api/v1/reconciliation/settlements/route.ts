import type { NextRequest } from "next/server";
import { prisma, type Prisma } from "@dropflow/db";
import { ImportSettlementInput } from "@dropflow/types";
import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const sp = req.nextUrl.searchParams;
		const page = Number(sp.get("page") ?? 1);
		const pageSize = Number(sp.get("pageSize") ?? 20);
		const gateway = sp.get("gateway") ?? undefined;
		const status = sp.get("status") ?? undefined;

		const where: Prisma.SettlementWhereInput = { tenantId };
		if (gateway) where.gateway = gateway;
		if (status) where.status = status;

		const [items, total] = await Promise.all([
			prisma.settlement.findMany({
				where,
				include: { _count: { select: { items: true } } },
				orderBy: { settlementDate: "desc" },
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
			prisma.settlement.count({ where }),
		]);

		return paginated(items, total, page, pageSize);
	} catch (e) {
		return err("SETTLEMENTS_FETCH_FAILED", e instanceof Error ? e.message : "Failed", 500);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const body = await req.json();
		const input = ImportSettlementInput.parse(body);

		const settlement = await prisma.settlement.create({
			data: {
				tenantId,
				gateway: input.gateway,
				settlementId: input.settlementId,
				settlementDate: new Date(input.settlementDate),
				totalAmountPaise: input.totalAmountPaise,
				feePaise: input.feePaise,
				taxOnFeePaise: input.taxOnFeePaise,
				netAmountPaise: input.netAmountPaise,
				utrNumber: input.utrNumber,
				bankReference: input.bankReference,
				items: {
					create: input.items.map((item) => ({
						tenantId,
						gatewayPaymentId: item.gatewayPaymentId,
						orderId: item.orderId,
						amountPaise: item.amountPaise,
						feePaise: item.feePaise,
						taxPaise: item.taxPaise,
						netPaise: item.netPaise,
					})),
				},
			},
			include: { items: true },
		});

		const workerUrl = process.env.FLY_WORKER_URL ?? "http://localhost:3001";
		const workerSecret = process.env.WORKER_SECRET ?? "dev-secret-change-me-in-production";

		try {
			await fetch(`${workerUrl}/internal/enqueue`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "x-worker-secret": workerSecret },
				body: JSON.stringify({
					queue: "reconciliation-queue",
					jobName: "match-settlement",
					payload: { tenantId, settlementId: settlement.id },
				}),
			});
		} catch (enqueueErr) {
			console.error("Failed to enqueue settlement match:", enqueueErr);
		}

		return ok(settlement, 201);
	} catch (e) {
		return err("SETTLEMENT_IMPORT_FAILED", e instanceof Error ? e.message : "Failed", 400);
	}
}
