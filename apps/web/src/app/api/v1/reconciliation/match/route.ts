import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { ManualMatchInput } from "@dropflow/types";
import { ReconciliationStatus } from "@prisma/client";

const PAYMENT_GATEWAY_TYPE = "PAYMENT_GATEWAY";
const COD_CARRIER_TYPE = "COD_CARRIER";

async function refreshSettlementHeaderStatus(
	tenantId: string,
	settlementId: string,
	itemIds: string[],
): Promise<void> {
	if (itemIds.length === 0) return;

	const records = await prisma.reconciliationRecord.findMany({
		where: {
			tenantId,
			type: PAYMENT_GATEWAY_TYPE,
			referenceId: { in: itemIds },
		},
		select: { status: true },
	});

	let status = "PENDING";
	if (records.length === itemIds.length) {
		const allClear = records.every(
			(r) =>
				r.status === ReconciliationStatus.MATCHED ||
				r.status === ReconciliationStatus.MANUAL_OVERRIDE,
		);
		const anyDisc = records.some(
			(r) => r.status === ReconciliationStatus.DISCREPANCY,
		);
		const anyUnmatched = records.some(
			(r) => r.status === ReconciliationStatus.UNMATCHED,
		);
		if (allClear && !anyDisc && !anyUnmatched) {
			status = "SETTLED";
		} else if (anyDisc) {
			status = "DISCREPANCY";
		}
	}

	await prisma.settlement.update({
		where: { id: settlementId },
		data: { status },
	});
}

async function refreshCodRemittanceHeaderStatus(
	tenantId: string,
	remittanceId: string,
	itemIds: string[],
): Promise<void> {
	if (itemIds.length === 0) return;

	const records = await prisma.reconciliationRecord.findMany({
		where: {
			tenantId,
			type: COD_CARRIER_TYPE,
			referenceId: { in: itemIds },
		},
		select: { status: true },
	});

	let status = "PENDING";
	if (records.length === itemIds.length) {
		const allClear = records.every(
			(r) =>
				r.status === ReconciliationStatus.MATCHED ||
				r.status === ReconciliationStatus.MANUAL_OVERRIDE,
		);
		const anyDisc = records.some(
			(r) => r.status === ReconciliationStatus.DISCREPANCY,
		);
		const anyUnmatched = records.some(
			(r) => r.status === ReconciliationStatus.UNMATCHED,
		);
		if (allClear && !anyDisc && !anyUnmatched) {
			status = "SETTLED";
		} else if (anyDisc) {
			status = "DISCREPANCY";
		}
	}

	await prisma.codRemittance.update({
		where: { id: remittanceId },
		data: { status },
	});
}

export async function POST(req: Request) {
	try {
		const { tenantId, userId } = await getAuthTenant();
		const body = await req.json();
		const input = ManualMatchInput.parse(body);

		const record = await prisma.reconciliationRecord.findFirst({
			where: { id: input.recordId, tenantId },
		});

		if (!record) {
			return err("NOT_FOUND", "Reconciliation record not found", 404);
		}

		const now = new Date();

		if (record.type === PAYMENT_GATEWAY_TYPE) {
			const payment = await prisma.payment.findFirst({
				where: { id: input.matchedId, tenantId },
			});
			if (!payment) {
				return err("INVALID_PAYMENT", "Payment not found for tenant", 400);
			}

			const item = await prisma.settlementItem.findFirst({
				where: { id: record.referenceId, tenantId },
			});
			if (!item) {
				return err("INVALID_REFERENCE", "Settlement line not found", 400);
			}

			await prisma.$transaction([
				prisma.settlementItem.update({
					where: { id: item.id },
					data: { isMatched: true, matchedPaymentId: payment.id },
				}),
				prisma.reconciliationRecord.update({
					where: { id: record.id },
					data: {
						status: ReconciliationStatus.MANUAL_OVERRIDE,
						matchedId: payment.id,
						actualAmountPaise: payment.amountPaise,
						differencePaise: item.amountPaise - payment.amountPaise,
						notes: input.notes ?? record.notes,
						resolvedAt: now,
						resolvedBy: userId,
					},
				}),
			]);

			const allItemIds = (
				await prisma.settlementItem.findMany({
					where: { settlementId: item.settlementId },
					select: { id: true },
				})
			).map((x) => x.id);
			await refreshSettlementHeaderStatus(
				tenantId,
				item.settlementId,
				allItemIds,
			);
		} else if (record.type === COD_CARRIER_TYPE) {
			const order = await prisma.order.findFirst({
				where: { id: input.matchedId, tenantId },
			});
			if (!order) {
				return err("INVALID_ORDER", "Order not found for tenant", 400);
			}

			const codItem = await prisma.codRemittanceItem.findFirst({
				where: { id: record.referenceId, tenantId },
			});
			if (!codItem) {
				return err("INVALID_REFERENCE", "COD remittance line not found", 400);
			}

			await prisma.$transaction([
				prisma.codRemittanceItem.update({
					where: { id: codItem.id },
					data: { isMatched: true, matchedOrderId: order.id },
				}),
				prisma.reconciliationRecord.update({
					where: { id: record.id },
					data: {
						status: ReconciliationStatus.MANUAL_OVERRIDE,
						matchedId: order.id,
						expectedAmountPaise: order.totalPaise,
						actualAmountPaise: codItem.amountPaise,
						differencePaise: order.totalPaise - codItem.amountPaise,
						notes: input.notes ?? record.notes,
						resolvedAt: now,
						resolvedBy: userId,
					},
				}),
			]);

			const allCodItemIds = (
				await prisma.codRemittanceItem.findMany({
					where: { remittanceId: codItem.remittanceId },
					select: { id: true },
				})
			).map((x) => x.id);
			await refreshCodRemittanceHeaderStatus(
				tenantId,
				codItem.remittanceId,
				allCodItemIds,
			);
		} else {
			await prisma.reconciliationRecord.update({
				where: { id: record.id },
				data: {
					status: ReconciliationStatus.MANUAL_OVERRIDE,
					matchedId: input.matchedId,
					notes: input.notes ?? record.notes,
					resolvedAt: now,
					resolvedBy: userId,
				},
			});
		}

		return ok({ id: record.id });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Failed";
		if (
			msg === "Unauthorized" ||
			msg === "No organization selected" ||
			msg === "Tenant not found"
		) {
			return err("UNAUTHORIZED", msg, 401);
		}
		return err("MANUAL_MATCH_FAILED", msg, 400);
	}
}
