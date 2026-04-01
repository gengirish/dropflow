import { err, ok, paginated } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import type { Prisma, ShipmentCarrier } from "@dropflow/db";
import { prisma } from "@dropflow/db";
import type { NextRequest } from "next/server";
import { z } from "zod";

const CarrierEnum = z.enum([
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
]);

const ServiceabilityRecord = z.object({
	pincode: z.string().regex(/^\d{6}$/),
	carrier: CarrierEnum,
	isServiceable: z.boolean().optional().default(true),
	isCodAvailable: z.boolean().optional().default(true),
	estimatedDays: z.number().int().positive().nullable().optional(),
	zone: z.string().min(1).nullable().optional(),
});

const BulkServiceabilityInput = z.object({
	records: z.array(ServiceabilityRecord).min(1).max(500),
});

function mapAuthError(e: unknown): ReturnType<typeof err> | null {
	const msg = e instanceof Error ? e.message : "";
	if (msg === "Unauthorized") return err("UNAUTHORIZED", "Unauthorized", 401);
	if (msg === "No organization selected" || msg === "Tenant not found") {
		return err("TENANT_ERROR", msg, 400);
	}
	return null;
}

export async function GET(req: NextRequest) {
	try {
		await getAuthTenant();
		const sp = req.nextUrl.searchParams;
		const page = Math.max(1, Number(sp.get("page") ?? 1));
		const pageSize = Math.min(
			100,
			Math.max(1, Number(sp.get("pageSize") ?? 20)),
		);
		const pincode = sp.get("pincode")?.trim();
		const carrierRaw = sp.get("carrier")?.trim();

		const carrierParse = carrierRaw
			? CarrierEnum.safeParse(carrierRaw)
			: { success: true as const, data: undefined };
		if (!carrierParse.success) {
			return err("INVALID_FILTER", "Invalid carrier filter", 400);
		}

		const conditions: Prisma.PincodeServiceabilityWhereInput[] = [];
		if (pincode) {
			conditions.push({ pincode: { startsWith: pincode } });
		}
		if (carrierParse.data) {
			conditions.push({ carrier: carrierParse.data as ShipmentCarrier });
		}

		const where: Prisma.PincodeServiceabilityWhereInput =
			conditions.length === 0
				? {}
				: conditions.length === 1 && conditions[0] !== undefined
					? conditions[0]
					: { AND: conditions };

		const [items, total] = await Promise.all([
			prisma.pincodeServiceability.findMany({
				where,
				orderBy: [{ pincode: "asc" }, { carrier: "asc" }],
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
			prisma.pincodeServiceability.count({ where }),
		]);

		return paginated(items, total, page, pageSize);
	} catch (e) {
		const authErr = mapAuthError(e);
		if (authErr) return authErr;
		return err(
			"SERVICEABILITY_FETCH_FAILED",
			e instanceof Error ? e.message : "Failed to list serviceability",
			500,
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		await getAuthTenant();
		const body = await req.json();
		const input = BulkServiceabilityInput.parse(body);

		const now = new Date();
		let upserted = 0;

		for (const r of input.records) {
			await prisma.pincodeServiceability.upsert({
				where: {
					pincode_carrier: {
						pincode: r.pincode,
						carrier: r.carrier as ShipmentCarrier,
					},
				},
				create: {
					pincode: r.pincode,
					carrier: r.carrier as ShipmentCarrier,
					isServiceable: r.isServiceable,
					isCodAvailable: r.isCodAvailable,
					estimatedDays: r.estimatedDays ?? null,
					zone: r.zone ?? null,
					lastVerifiedAt: now,
				},
				update: {
					isServiceable: r.isServiceable,
					isCodAvailable: r.isCodAvailable,
					...(r.estimatedDays !== undefined
						? { estimatedDays: r.estimatedDays }
						: {}),
					...(r.zone !== undefined ? { zone: r.zone } : {}),
					lastVerifiedAt: now,
				},
			});
			upserted += 1;
		}

		return ok({ upserted });
	} catch (e) {
		const authErr = mapAuthError(e);
		if (authErr) return authErr;
		return err(
			"SERVICEABILITY_UPSERT_FAILED",
			e instanceof Error ? e.message : "Failed to upsert serviceability",
			400,
		);
	}
}
