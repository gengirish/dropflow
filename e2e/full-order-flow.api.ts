import { test, expect } from "@playwright/test";

/**
 * E2E API test: Full order lifecycle
 *
 * Tests: create supplier -> create product -> create order ->
 * generate invoice -> update status -> update inventory -> filters
 *
 * Uses x-e2e-test-key header to bypass Clerk in development mode.
 */

const API = "http://localhost:3000/api/v1";
const H = { "x-e2e-test-key": "dropflow-e2e-test-secret-key-2024" };

let supplierId: string;
let productId: string;
let orderId: string;

test.describe.serial("Full Order Flow E2E", () => {
  test("1. Create supplier", async ({ request }) => {
    const res = await request.post(`${API}/catalog/suppliers`, {
      headers: H,
      data: {
        name: "E2E Test Supplier",
        contactEmail: "e2e@test.com",
        contactPhone: "+919876543210",
        leadTimeDays: 3,
      },
    });

    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    supplierId = json.data.id;
    expect(supplierId).toBeTruthy();
  });

  test("2. Create product", async ({ request }) => {
    const res = await request.post(`${API}/catalog/products`, {
      headers: H,
      data: {
        name: "E2E Test T-Shirt",
        sku: `E2E-${Date.now()}`,
        supplierId,
        hsnCode: "6109",
        costPricePaise: 30000,
        sellingPricePaise: 59900,
        gstRatePercent: 5,
        stockQty: 50,
      },
    });

    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    productId = json.data.id;
    expect(json.data.stockQty).toBe(50);
  });

  test("3. List products", async ({ request }) => {
    const res = await request.get(`${API}/catalog/products`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.items.length).toBeGreaterThan(0);
    expect(json.data.items.find((p: { id: string }) => p.id === productId)).toBeTruthy();
  });

  test("4. Create order (pricing verified)", async ({ request }) => {
    const res = await request.post(`${API}/orders`, {
      headers: H,
      data: {
        buyerName: "E2E Test Buyer",
        buyerEmail: "buyer@e2etest.com",
        buyerPhone: "+919876543210",
        shippingAddress: {
          line1: "123 Test Street",
          city: "Bangalore",
          state: "Karnataka",
          pin: "560001",
          country: "IN",
        },
        billingAddress: {
          line1: "123 Test Street",
          city: "Bangalore",
          state: "Karnataka",
          pin: "560001",
          country: "IN",
        },
        items: [{ productId, quantity: 2 }],
      },
    });

    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    orderId = json.data.id;
    expect(json.data.orderNumber).toMatch(/^ORD-/);
    expect(json.data.status).toBe("PENDING");
    expect(json.data.items).toHaveLength(1);
    expect(json.data.items[0].quantity).toBe(2);
    expect(json.data.subtotalPaise).toBe(119800);
    expect(json.data.taxPaise).toBe(5990);
    expect(json.data.totalPaise).toBe(125790);
  });

  test("5. Get order detail", async ({ request }) => {
    const res = await request.get(`${API}/orders/${orderId}`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(orderId);
    expect(json.data.buyerName).toBe("E2E Test Buyer");
    expect(json.data.statusHistory.length).toBeGreaterThanOrEqual(1);
  });

  test("6. List orders", async ({ request }) => {
    const res = await request.get(`${API}/orders`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.total).toBeGreaterThan(0);
    expect(json.data.items.find((o: { id: string }) => o.id === orderId)).toBeTruthy();
  });

  test("7. Generate GST invoice (CGST+SGST intra-state)", async ({ request }) => {
    const res = await request.post(`${API}/invoices`, {
      headers: H,
      data: { orderId },
    });

    expect([200, 201]).toContain(res.status());
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.invoiceNumber).toMatch(/^INV\//);
    expect(json.data.orderId).toBe(orderId);
    expect(json.data.gstType).toBe("CGST_SGST");
    expect(json.data.totalTaxPaise).toBeGreaterThan(0);
    expect(json.data.cgstPaise).toBeGreaterThan(0);
    expect(json.data.sgstPaise).toBeGreaterThan(0);
    expect(json.data.igstPaise).toBe(0);
  });

  test("8. List invoices", async ({ request }) => {
    const res = await request.get(`${API}/invoices`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.total).toBeGreaterThan(0);
  });

  test("9. Update order status to SHIPPED", async ({ request }) => {
    const res = await request.patch(`${API}/orders/${orderId}/status`, {
      headers: H,
      data: { status: "SHIPPED", note: "E2E test: shipped" },
    });

    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("SHIPPED");
  });

  test("10. Update inventory", async ({ request }) => {
    const res = await request.patch(`${API}/catalog/inventory/${productId}`, {
      headers: H,
      data: { delta: -5, reason: "E2E test adjustment" },
    });

    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.reason).toBe("E2E test adjustment");
  });

  test("11. Filter orders by status", async ({ request }) => {
    const res = await request.get(`${API}/orders?status=SHIPPED`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    for (const order of json.data.items) {
      expect(order.status).toBe("SHIPPED");
    }
  });

  test("12. Search orders by name", async ({ request }) => {
    const res = await request.get(`${API}/orders?search=E2E`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test("13. List shipments", async ({ request }) => {
    const res = await request.get(`${API}/shipments`, { headers: H });
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
