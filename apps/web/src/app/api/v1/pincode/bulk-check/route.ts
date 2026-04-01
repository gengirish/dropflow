import { err, ok } from "@/lib/api-response";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { BulkPincodeCheckInput } from "@dropflow/types";
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
		await getAuthTenant();
		const body = await req.json();
		const input = BulkPincodeCheckInput.parse(body);
		const pincodes = input.pincodes;

		const rows = await prisma.pincodeServiceability.findMany({
			where: { pincode: { in: pincodes } },
			orderBy: [{ pincode: "asc" }, { carrier: "asc" }],
		});

		const byPin = new Map<string, typeof rows>();
		for (const row of rows) {
			const list = byPin.get(row.pincode) ?? [];
			list.push(row);
			byPin.set(row.pincode, list);
		}

		const results = pincodes.map((pincode) => {
			const list = byPin.get(pincode) ?? [];
			const simplified = list.map((r) => ({
				carrier: r.carrier,
				isServiceable: r.isServiceable,
				isCodAvailable: r.isCodAvailable,
				estimatedDays: r.estimatedDays,
				zone: r.zone,
			}));
			return {
				pincode,
				isServiceable: simplified.some((c) => c.isServiceable),
				carriers: simplified,
			};
		});

		return ok(results);
	} catch (e) {
		const authErr = mapAuthError(e);
		if (authErr) return authErr;
		return err(
			"BULK_PINCODE_CHECK_FAILED",
			e instanceof Error ? e.message : "Bulk pincode check failed",
			400,
		);
	}
}
