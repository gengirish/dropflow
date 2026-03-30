import type { NextRequest } from "next/server";
import { getAuthTenant } from "@/lib/auth";
import { prisma } from "@dropflow/db";
import { ok, err } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await getAuthTenant();
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        order: {
          select: {
            orderNumber: true,
            buyerName: true,
            buyerEmail: true,
            buyerPhone: true,
            shippingAddress: true,
            billingAddress: true,
            items: {
              include: { product: { select: { name: true, sku: true, hsnCode: true } } },
            },
          },
        },
      },
    });

    if (!invoice) return err("NOT_FOUND", "Invoice not found", 404);

    return ok(invoice);
  } catch (e) {
    return err("INVOICE_FETCH_FAILED", e instanceof Error ? e.message : "Failed", 500);
  }
}
