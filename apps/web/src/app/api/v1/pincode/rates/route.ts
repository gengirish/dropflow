import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import type { Prisma, ShipmentCarrier } from "@dropflow/db";
import { prisma } from "@dropflow/db";
import { CarrierRateInput } from "@dropflow/types";
import type { NextRequest } from "next/server";
import { z } from "zod";

const CarrierFilter = z
	.enum([
		"SHIPROCKET",
		"DELHIVERY",
		"DTDC",
		"BLUEDART",
		"ECOM_EXPRESS",
		"XPRESSBEES",
		"EASYPOST_DHL",
		"EASYPOST_FEDEX",
		"EASYPOST_UPS",
		"SELF",
	])
	.optional();

function mapAuthError(e: unknown): ReturnType<typeof err> | null {
	const msg = e instanceof Error ? e.message : "";
	if (msg === "Unauthorized") return err("UNAUTHORIZED", "Unauthorized", 401);
	if (msg === "No organization selected" || msg === "Tenant not found") {
		return err("TENANT_ERROR", msg, 400);
	}
	return null;
}

function parseRateDates(input: z.infer<typeof CarrierRateInput>) {
	const validFrom = new Date(input.validFrom);
	const validTo = input.validTo ? new Date(input.validTo) : null;
	if (Number.isNaN(validFrom.getTime())) {
		throw new Error("validFrom must be a valid ISO date string");
	}
	if (input.validTo && validTo && Number.isNaN(validTo.getTime())) {
		throw new Error("validTo must be a valid ISO date string");
	}
	if (validTo && validTo < validFrom) {
		throw new Error("validTo must be on or after validFrom");
	}
	if (input.maxWeightGrams <= input.minWeightGrams) {
		throw new Error("maxWeightGrams must be greater than minWeightGrams");
	}
	return { validFrom, validTo };
}

export async function GET(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const sp = req.nextUrl.searchParams;
		const page = Math.max(1, Number(sp.get("page") ?? 1));
		const pageSize = Math.min(
			100,
			Math.max(1, Number(sp.get("pageSize") ?? 20)),
		);
		const carrierRaw = sp.get("carrier");
		const zone = sp.get("zone")?.trim();

		const carrierParse = carrierRaw
			? CarrierFilter.safeParse(carrierRaw)
			: { success: true as const, data: undefined };
		if (!carrierParse.success) {
			return err("INVALID_FILTER", "Invalid carrier filter", 400);
		}

		const conditions: Prisma.CarrierRateWhereInput[] = [{ tenantId }];
		if (carrierParse.data) {
			conditions.push({ carrier: carrierParse.data as ShipmentCarrier });
		}
		if (zone) {
			conditions.push({ zone: { contains: zone, mode: "insensitive" } });
		}

		const where: Prisma.CarrierRateWhereInput =
			conditions.length === 1 && conditions[0] !== undefined
				? conditions[0]
				: { AND: conditions };

		const [items, total] = await Promise.all([
			prisma.carrierRate.findMany({
				where,
				orderBy: [
					{ carrier: "asc" },
					{ zone: "asc" },
					{ minWeightGrams: "asc" },
				],
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
			prisma.carrierRate.count({ where }),
		]);

		return paginated(items, total, page, pageSize);
	} catch (e) {
		const authErr = mapAuthError(e);
		if (authErr) return authErr;
		return err(
			"RATES_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to fetch rates",
			500,
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { tenantId } = await getAuthTenant();
		const body = await req.json();
		const input = CarrierRateInput.parse(body);
		const { validFrom, validTo } = parseRateDates(input);

		const row = await prisma.carrierRate.create({
			data: {
				tenantId,
				carrier: input.carrier as ShipmentCarrier,
				zone: input.zone,
				minWeightGrams: input.minWeightGrams,
				maxWeightGrams: input.maxWeightGrams,
				basePricePaise: input.basePricePaise,
				additionalPerGramPaise: input.additionalPerGramPaise,
				codChargePaise: input.codChargePaise,
				fuelSurchargePercent: input.fuelSurchargePercent,
				validFrom,
				validTo,
				isActive: true,
			},
		});

		return ok(row, 201);
	} catch (e) {
		const authErr = mapAuthError(e);
		if (authErr) return authErr;
		return err(
			"RATE_CREATE_FAILED",
			e instanceof Error ? e.message : "Failed to create rate",
			400,
		);
	}
}
