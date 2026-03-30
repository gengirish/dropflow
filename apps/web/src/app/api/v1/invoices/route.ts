import type { NextRequest } from "next/server";
import { getAuthTenant } from "@/lib/auth";
import { prisma, type Prisma } from "@dropflow/db";
import { ok, err, paginated } from "@/lib/api-response";
import { InvoiceFilters } from "@dropflow/types";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getAuthTenant();
    const sp = req.nextUrl.searchParams;

    const filters = InvoiceFilters.parse({
      orderId: sp.get("orderId") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      gstType: sp.get("gstType") ?? undefined,
      page: sp.get("page") ?? 1,
      pageSize: sp.get("pageSize") ?? 20,
    });

    const where: Prisma.InvoiceWhereInput = { tenantId };
    if (filters.orderId) where.orderId = filters.orderId;
    if (filters.gstType) where.gstType = filters.gstType;
    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) createdAt.lte = new Date(filters.dateTo);
      where.createdAt = createdAt;
    }

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, buyerName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return paginated(items, total, filters.page, filters.pageSize);
  } catch (e) {
    return err("INVOICES_FETCH_FAILED", e instanceof Error ? e.message : "Failed", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, tenant } = await getAuthTenant();
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) return err("MISSING_ORDER_ID", "orderId is required", 400);

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { items: { include: { product: true } } },
    });

    if (!order) return err("NOT_FOUND", "Order not found", 404);

    const existing = await prisma.invoice.findUnique({
      where: { orderId },
    });
    if (existing) return ok(existing);

    const { calculateGST } = await import("@dropflow/gst");
    const buyerState = (order.shippingAddress as Record<string, string>)?.state ?? null;
    const sellerState = tenant.sellerStateCode ?? "29";

    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const item of order.items) {
      const gst = calculateGST({
        subtotalPaise: item.totalPaise,
        hsnCode: item.hsnCode,
        sellerStateCode: sellerState,
        buyerStateCode: buyerState,
        isExport: false,
      });
      totalCgst += gst.cgstPaise;
      totalSgst += gst.sgstPaise;
      totalIgst += gst.igstPaise;
    }

    const gstType = totalIgst > 0 ? "IGST" : totalCgst > 0 ? "CGST_SGST" : "EXEMPT";
    const totalTax = totalCgst + totalSgst + totalIgst;

    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const invoiceNumber = `INV/${yy}${mm}/${rand}`;

    const invoice = await prisma.invoice.create({
      data: {
        orderId,
        tenantId,
        invoiceNumber,
        gstType: gstType as "CGST_SGST" | "IGST" | "EXPORT_LUT" | "EXEMPT",
        subtotalPaise: order.subtotalPaise,
        cgstPaise: totalCgst,
        sgstPaise: totalSgst,
        igstPaise: totalIgst,
        totalTaxPaise: totalTax,
        totalPaise: order.subtotalPaise + totalTax,
        currency: order.currency,
      },
    });

    return ok(invoice, 201);
  } catch (e) {
    return err("INVOICE_CREATE_FAILED", e instanceof Error ? e.message : "Failed", 400);
  }
}
