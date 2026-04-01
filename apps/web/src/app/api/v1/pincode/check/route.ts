import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import {
	DEFAULT_PINCODE_CHECK_WEIGHT_GRAMS,
	buildCarrierOption,
	pickCheapestCarrier,
	pickFastestCarrier,
} from "@/lib/pincode-rate-engine";
import { prisma } from "@dropflow/db";
import { PincodeCheckInput, type PincodeCheckResponse } from "@dropflow/types";
import type { NextRequest } from "next/server";

function mapAuthError(e: unknown): ReturnType<typeof err> | null {
	const msg = e instanceof Error ? e.message : "";
	if (msg === "Unauthorized") return err("UNAUTHORIZED", "Unauthorized", 401);
	if (msg === "No organization selected" || msg === "Tenant not found") {
		return err("TENANT_ERROR", msg, 400);
	}
	return null;
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const body = await req.json();
		const input = PincodeCheckInput.parse(body);
		const weightGrams = input.weightGrams ?? DEFAULT_PINCODE_CHECK_WEIGHT_GRAMS;

		const [rows, deliverability] = await Promise.all([
			prisma.pincodeServiceability.findMany({
				where: { pincode: input.pincode },
				orderBy: { carrier: "asc" },
			}),
			prisma.pincodeDeliverability.findUnique({
				where: { pincode: input.pincode },
			}),
		]);

		const carriers = await Promise.all(
			rows.map((row) =>
				buildCarrierOption(
					tenantId,
					{
						carrier: row.carrier,
						isServiceable: row.isServiceable,
						isCodAvailable: row.isCodAvailable,
						estimatedDays: row.estimatedDays,
						zone: row.zone,
					},
					weightGrams,
					input.isCod,
				),
			),
		);

		const isServiceable = carriers.some((c) => c.isServiceable);
		const isCodAvailable = carriers.some(
			(c) => c.isServiceable && c.isCodAvailable,
		);

		const response: PincodeCheckResponse = {
			pincode: input.pincode,
			isServiceable,
			isCodAvailable,
			carriers,
			cheapestCarrier: pickCheapestCarrier(carriers),
			fastestCarrier: pickFastestCarrier(carriers),
			deliverability: deliverability
				? {
						deliveryRate: deliverability.deliveryRate,
						avgDeliveryDays: deliverability.avgDeliveryDays,
						totalShipments: deliverability.totalShipments,
					}
				: null,
		};

		return ok(response);
	} catch (e) {
		const authErr = mapAuthError(e);
		if (authErr) return authErr;
		return err(
			"PINCODE_CHECK_FAILED",
			e instanceof Error ? e.message : "Pincode check failed",
			400,
		);
	}
}
