import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import type { ShipmentCarrier } from "@dropflow/db";
import { type Prisma, prisma } from "@dropflow/db";
import { CarrierRateInput } from "@dropflow/types";
import type { NextRequest } from "next/server";
import { z } from "zod";

const CarrierRatePatch = CarrierRateInput.partial().extend({
	validTo: z.union([z.string(), z.null()]).optional(),
});

function mapAuthError(e: unknown): ReturnType<typeof err> | null {
	const msg = e instanceof Error ? e.message : "";
	if (msg === "Unauthorized") return err("UNAUTHORIZED", "Unauthorized", 401);
	if (msg === "No organization selected" || msg === "Tenant not found") {
		return err("TENANT_ERROR", msg, 400);
	}
	return null;
}

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await params;

		const row = await prisma.carrierRate.findFirst({
			where: { id, tenantId },
		});

		if (!row) {
			return err("NOT_FOUND", "Carrier rate not found", 404);
		}

		return ok(row);
	} catch (e) {
		const authErr = mapAuthError(e);
		if (authErr) return authErr;
		return err(
			"RATE_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to fetch rate",
			500,
		);
	}
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await params;
		const body = await req.json();
		const patch = CarrierRatePatch.parse(body);

		const existing = await prisma.carrierRate.findFirst({
			where: { id, tenantId },
		});

		if (!existing) {
			return err("NOT_FOUND", "Carrier rate not found", 404);
		}

		const minWeightGrams = patch.minWeightGrams ?? existing.minWeightGrams;
		const maxWeightGrams = patch.maxWeightGrams ?? existing.maxWeightGrams;
		if (maxWeightGrams <= minWeightGrams) {
			return err(
				"INVALID_WEIGHT_RANGE",
				"maxWeightGrams must be greater than minWeightGrams",
				400,
			);
		}

		const validFrom = patch.validFrom
			? new Date(patch.validFrom)
			: existing.validFrom;
		if (patch.validFrom && Number.isNaN(validFrom.getTime())) {
			return err(
				"INVALID_DATE",
				"validFrom must be a valid ISO date string",
				400,
			);
		}

		let validTo: Date | null;
		if (patch.validTo !== undefined) {
			validTo = patch.validTo ? new Date(patch.validTo) : null;
			if (patch.validTo && validTo && Number.isNaN(validTo.getTime())) {
				return err(
					"INVALID_DATE",
					"validTo must be a valid ISO date string",
					400,
				);
			}
		} else {
			validTo = existing.validTo;
		}

		const vf = patch.validFrom ? validFrom : existing.validFrom;
		const vt = patch.validTo !== undefined ? validTo : existing.validTo;
		if (vt && vf && vt < vf) {
			return err(
				"INVALID_DATE_RANGE",
				"validTo must be on or after validFrom",
				400,
			);
		}

		const data: Prisma.CarrierRateUpdateInput = {};
		if (patch.carrier !== undefined)
			data.carrier = patch.carrier as ShipmentCarrier;
		if (patch.zone !== undefined) data.zone = patch.zone;
		if (patch.minWeightGrams !== undefined)
			data.minWeightGrams = patch.minWeightGrams;
		if (patch.maxWeightGrams !== undefined)
			data.maxWeightGrams = patch.maxWeightGrams;
		if (patch.basePricePaise !== undefined)
			data.basePricePaise = patch.basePricePaise;
		if (patch.additionalPerGramPaise !== undefined)
			data.additionalPerGramPaise = patch.additionalPerGramPaise;
		if (patch.codChargePaise !== undefined)
			data.codChargePaise = patch.codChargePaise;
		if (patch.fuelSurchargePercent !== undefined)
			data.fuelSurchargePercent = patch.fuelSurchargePercent;
		if (patch.validFrom !== undefined) data.validFrom = validFrom;
		if (patch.validTo !== undefined) data.validTo = validTo;

		const row = await prisma.carrierRate.update({
			where: { id },
			data,
		});

		return ok(row);
	} catch (e) {
		const authErr = mapAuthError(e);
		if (authErr) return authErr;
		return err(
			"RATE_UPDATE_FAILED",
			e instanceof Error ? e.message : "Failed to update rate",
			400,
		);
	}
}

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { tenantId } = await getAuthTenant();
		const { id } = await params;

		const existing = await prisma.carrierRate.findFirst({
			where: { id, tenantId },
		});

		if (!existing) {
			return err("NOT_FOUND", "Carrier rate not found", 404);
		}

		await prisma.carrierRate.delete({ where: { id } });

		return ok({ deleted: true });
	} catch (e) {
		const authErr = mapAuthError(e);
		if (authErr) return authErr;
		return err(
			"RATE_DELETE_FAILED",
			e instanceof Error ? e.message : "Failed to delete rate",
			500,
		);
	}
}
