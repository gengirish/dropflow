import { test, expect } from "@playwright/test";

/**
 * Production E2E: Tests the deployed DropFlow app on Vercel.
 * Runs the full order lifecycle against the live API.
 */

const API = process.env.PROD_URL
  ? `${process.env.PROD_URL}/api/v1`
  : "https://dropflow-beta.vercel.app/api/v1";

const H = {
  "x-e2e-test-key": "dropflow-e2e-test-secret-key-2024",
};

let supplierId: string;
let productId: string;
let orderId: string;

test.describe.serial("Production E2E — Full Order Flow", () => {
  test("1. Create supplier", async ({ request }) => {
    const res = await request.post(`${API}/catalog/suppliers`, {
      headers: H,
      data: {
        name: `Prod Test Supplier ${Date.now()}`,
        contactEmail: "prod@e2e.test",
        leadTimeDays: 3,
      },
    });

    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    supplierId = json.data.id;
  });

  test("2. Create product", async ({ request }) => {
    const res = await request.post(`${API}/catalog/products`, {
      headers: H,
      data: {
        name: "Prod Test T-Shirt",
        sku: `PROD-${Date.now()}`,
        supplierId,
        hsnCode: "6109",
        costPricePaise: 25000,
        sellingPricePaise: 49900,
        gstRatePercent: 5,
        stockQty: 100,
      },
    });

    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    productId = json.data.id;
    expect(json.data.stockQty).toBe(100);
  });

  test("3. List products", async ({ request }) => {
    const res = await request.get(`${API}/catalog/products`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.items.length).toBeGreaterThan(0);
  });

  test("4. Create order with pricing verification", async ({ request }) => {
    const res = await request.post(`${API}/orders`, {
      headers: H,
      data: {
        buyerName: "Prod E2E Buyer",
        buyerEmail: "prod-buyer@e2e.test",
        buyerPhone: "+919876543210",
        shippingAddress: {
          line1: "42 MG Road",
          city: "Bangalore",
          state: "Karnataka",
          pin: "560001",
          country: "IN",
        },
        billingAddress: {
          line1: "42 MG Road",
          city: "Bangalore",
          state: "Karnataka",
          pin: "560001",
          country: "IN",
        },
        items: [{ productId, quantity: 3 }],
      },
    });

    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    orderId = json.data.id;

    expect(json.data.orderNumber).toMatch(/^ORD-/);
    expect(json.data.status).toBe("PENDING");
    // 3 x 49900 = 149700
    expect(json.data.subtotalPaise).toBe(149700);
    // 5% tax = 7485
    expect(json.data.taxPaise).toBe(7485);
    expect(json.data.totalPaise).toBe(157185);
  });

  test("5. Get order detail", async ({ request }) => {
    const res = await request.get(`${API}/orders/${orderId}`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.data.id).toBe(orderId);
    expect(json.data.buyerName).toBe("Prod E2E Buyer");
    expect(json.data.items).toHaveLength(1);
    expect(json.data.statusHistory.length).toBeGreaterThanOrEqual(1);
  });

  test("6. Generate GST invoice (intra-state CGST+SGST)", async ({ request }) => {
    const res = await request.post(`${API}/invoices`, {
      headers: H,
      data: { orderId },
    });

    expect([200, 201]).toContain(res.status());
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.invoiceNumber).toMatch(/^INV\//);
    expect(json.data.gstType).toBe("CGST_SGST");
    expect(json.data.cgstPaise).toBeGreaterThan(0);
    expect(json.data.sgstPaise).toBeGreaterThan(0);
    expect(json.data.igstPaise).toBe(0);
    expect(json.data.totalTaxPaise).toBe(json.data.cgstPaise + json.data.sgstPaise);
  });

  test("7. List invoices", async ({ request }) => {
    const res = await request.get(`${API}/invoices`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.data.total).toBeGreaterThan(0);
  });

  test("8. Update order status", async ({ request }) => {
    const res = await request.patch(`${API}/orders/${orderId}/status`, {
      headers: H,
      data: { status: "PROCESSING", note: "Production E2E" },
    });

    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.data.status).toBe("PROCESSING");
  });

  test("9. Update inventory", async ({ request }) => {
    const res = await request.patch(`${API}/catalog/inventory/${productId}`, {
      headers: H,
      data: { delta: -10, reason: "Prod E2E stock adjustment" },
    });

    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.data.stockQty).toBe(90);
  });

  test("10. Search and filter orders", async ({ request }) => {
    const res = await request.get(`${API}/orders?search=Prod+E2E`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.data.items.length).toBeGreaterThan(0);
  });

  test("11. List shipments", async ({ request }) => {
    const res = await request.get(`${API}/shipments`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test("12. List suppliers", async ({ request }) => {
    const res = await request.get(`${API}/catalog/suppliers`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
  });
});
