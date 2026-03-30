import type { NextRequest } from "next/server";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { err, paginated } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get("page") ?? 1);
    const pageSize = Number(sp.get("pageSize") ?? 20);

    const where = { tenantId };

    const [items, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, buyerName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.shipment.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (e) {
    return err("SHIPMENTS_FETCH_FAILED", e instanceof Error ? e.message : "Failed", 500);
  }
}
