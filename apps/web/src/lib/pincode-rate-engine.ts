import { CARRIERS } from "@dropflow/config";
import type { CarrierRate, ShipmentCarrier } from "@dropflow/db";
import { prisma } from "@dropflow/db";
import type { CarrierOption } from "@dropflow/types";

/** Used when `weightGrams` is omitted on pincode check. */
export const DEFAULT_PINCODE_CHECK_WEIGHT_GRAMS = 500;

export function carrierDisplayName(carrier: ShipmentCarrier): string {
	return CARRIERS[carrier]?.displayName ?? carrier;
}

export function computeShippingPaise(
	rate: Pick<
		CarrierRate,
		| "basePricePaise"
		| "minWeightGrams"
		| "additionalPerGramPaise"
		| "fuelSurchargePercent"
	>,
	weightGrams: number,
): number {
	const excessGrams = Math.max(0, weightGrams - rate.minWeightGrams);
	const subtotal =
		rate.basePricePaise + Math.round(excessGrams * rate.additionalPerGramPaise);
	const withFuel = subtotal * (1 + rate.fuelSurchargePercent / 100);
	return Math.round(withFuel);
}

/**
 * Picks the active rate slab that contains `weightGrams`, preferring the narrowest weight range.
 */
export async function findApplicableCarrierRate(
	tenantId: string,
	carrier: ShipmentCarrier,
	zone: string | null | undefined,
	weightGrams: number,
	at: Date = new Date(),
): Promise<CarrierRate | null> {
	if (!zone) return null;

	const rates = await prisma.carrierRate.findMany({
		where: {
			tenantId,
			carrier,
			zone,
			isActive: true,
			minWeightGrams: { lte: weightGrams },
			maxWeightGrams: { gte: weightGrams },
			validFrom: { lte: at },
			OR: [{ validTo: null }, { validTo: { gte: at } }],
		},
		orderBy: { validFrom: "desc" },
	});

	if (rates.length === 0) return null;

	rates.sort((a, b) => {
		const ra = a.maxWeightGrams - a.minWeightGrams;
		const rb = b.maxWeightGrams - b.minWeightGrams;
		if (ra !== rb) return ra - rb;
		return b.validFrom.getTime() - a.validFrom.getTime();
	});

	return rates[0] ?? null;
}

export async function buildCarrierOption(
	tenantId: string,
	svc: {
		carrier: ShipmentCarrier;
		isServiceable: boolean;
		isCodAvailable: boolean;
		estimatedDays: number | null;
		zone: string | null;
	},
	weightGrams: number,
	requestCod: boolean,
): Promise<CarrierOption> {
	const rate = svc.isServiceable
		? await findApplicableCarrierRate(
				tenantId,
				svc.carrier,
				svc.zone,
				weightGrams,
			)
		: null;

	const ratePaise =
		svc.isServiceable && rate ? computeShippingPaise(rate, weightGrams) : null;

	const codChargePaise =
		svc.isServiceable && svc.isCodAvailable && rate ? rate.codChargePaise : 0;

	const totalPaise =
		ratePaise !== null ? ratePaise + (requestCod ? codChargePaise : 0) : null;

	return {
		carrier: svc.carrier,
		carrierDisplayName: carrierDisplayName(svc.carrier),
		isServiceable: svc.isServiceable,
		isCodAvailable: svc.isCodAvailable,
		estimatedDays: svc.estimatedDays,
		ratePaise,
		codChargePaise,
		totalPaise,
		zone: svc.zone,
	};
}

export function pickCheapestCarrier(
	carriers: CarrierOption[],
): CarrierOption | null {
	const eligible = carriers.filter(
		(c) => c.isServiceable && c.totalPaise !== null,
	);
	if (eligible.length === 0) return null;
	return eligible.reduce((a, b) =>
		(a.totalPaise ?? Number.POSITIVE_INFINITY) <=
		(b.totalPaise ?? Number.POSITIVE_INFINITY)
			? a
			: b,
	);
}

export function pickFastestCarrier(
	carriers: CarrierOption[],
): CarrierOption | null {
	const eligible = carriers.filter(
		(c) => c.isServiceable && c.estimatedDays !== null,
	);
	if (eligible.length === 0) return null;
	return eligible.reduce((a, b) =>
		(a.estimatedDays ?? Number.POSITIVE_INFINITY) <=
		(b.estimatedDays ?? Number.POSITIVE_INFINITY)
			? a
			: b,
	);
}
