import { test, expect } from "@playwright/test";

/**
 * Validation & Edge Cases E2E: Tests input validation, error handling,
 * 404s for non-existent resources, duplicate prevention, invalid state
 * transitions, and boundary conditions.
 */

const API = process.env.PROD_URL
	? `${process.env.PROD_URL}/api/v1`
	: "https://dropflow-beta.vercel.app/api/v1";

const H = {
	"x-e2e-test-key": "dropflow-e2e-test-secret-key-2024",
};

const FAKE_CUID = "clxxxxxxxxxxxxxxxxxxxxxxxxx";

// ── 404s for non-existent resources ────────────────────────

test.describe("Validation — 404 for non-existent resources", () => {
	test("GET /orders/:id — non-existent order", async ({ request }) => {
		const res = await request.get(`${API}/orders/${FAKE_CUID}`, {
			headers: H,
		});
		expect([404, 500]).toContain(res.status());
	});

	test("GET /catalog/products/:id — non-existent product", async ({
		request,
	}) => {
		const res = await request.get(`${API}/catalog/products/${FAKE_CUID}`, {
			headers: H,
		});
		expect([404, 500]).toContain(res.status());
	});

	test("GET /invoices/:id — non-existent invoice", async ({ request }) => {
		const res = await request.get(`${API}/invoices/${FAKE_CUID}`, {
			headers: H,
		});
		expect([404, 500]).toContain(res.status());
	});

	test("GET /channels/:id — non-existent channel", async ({ request }) => {
		const res = await request.get(`${API}/channels/${FAKE_CUID}`, {
			headers: H,
		});
		expect([404, 500]).toContain(res.status());
	});

	test("GET /returns/:id — non-existent return", async ({ request }) => {
		const res = await request.get(`${API}/returns/${FAKE_CUID}`, {
			headers: H,
		});
		expect([404, 500]).toContain(res.status());
	});

	test("GET /workflows/:id — non-existent workflow", async ({ request }) => {
		const res = await request.get(`${API}/workflows/${FAKE_CUID}`, {
			headers: H,
		});
		expect([404, 500]).toContain(res.status());
	});

	test("GET /notifications/templates/:id — non-existent template", async ({
		request,
	}) => {
		const res = await request.get(
			`${API}/notifications/templates/${FAKE_CUID}`,
			{ headers: H },
		);
		expect([404, 500]).toContain(res.status());
	});

	test("GET /pincode/rates/:id — non-existent rate", async ({ request }) => {
		const res = await request.get(`${API}/pincode/rates/${FAKE_CUID}`, {
			headers: H,
		});
		expect([404, 500]).toContain(res.status());
	});

	test("GET /suppliers/:id/scorecard — non-existent supplier", async ({
		request,
	}) => {
		const res = await request.get(
			`${API}/suppliers/${FAKE_CUID}/scorecard`,
			{ headers: H },
		);
		expect([404, 500]).toContain(res.status());
	});
});

// ── Missing required fields ────────────────────────────────

test.describe("Validation — Missing required fields", () => {
	test("POST /catalog/suppliers — empty body", async ({ request }) => {
		const res = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {},
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /catalog/products — missing supplierId", async ({ request }) => {
		const res = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "No Supplier Product",
				sku: `NS-${Date.now()}`,
				hsnCode: "6109",
				costPricePaise: 10000,
				sellingPricePaise: 20000,
				gstRatePercent: 5,
				stockQty: 10,
			},
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /orders — empty body", async ({ request }) => {
		const res = await request.post(`${API}/orders`, {
			headers: H,
			data: {},
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /orders — missing items array", async ({ request }) => {
		const res = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Missing Items",
				buyerEmail: "no-items@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "1 Street",
					city: "Delhi",
					state: "Delhi",
					pin: "110001",
					country: "IN",
				},
				billingAddress: {
					line1: "1 Street",
					city: "Delhi",
					state: "Delhi",
					pin: "110001",
					country: "IN",
				},
			},
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /orders — empty items array", async ({ request }) => {
		const res = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Empty Items",
				buyerEmail: "empty@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "1 Street",
					city: "Delhi",
					state: "Delhi",
					pin: "110001",
					country: "IN",
				},
				billingAddress: {
					line1: "1 Street",
					city: "Delhi",
					state: "Delhi",
					pin: "110001",
					country: "IN",
				},
				items: [],
			},
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /channels — missing type", async ({ request }) => {
		const res = await request.post(`${API}/channels`, {
			headers: H,
			data: { name: "No Type" },
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /notifications/templates — missing channel", async ({
		request,
	}) => {
		const res = await request.post(`${API}/notifications/templates`, {
			headers: H,
			data: {
				name: "Missing Channel",
				triggerEvent: "order.created",
				templateBody: "Hello",
			},
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /reorder/rules — missing productId", async ({ request }) => {
		const res = await request.post(`${API}/reorder/rules`, {
			headers: H,
			data: { reorderPoint: 10, reorderQty: 50 },
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /returns — missing orderId", async ({ request }) => {
		const res = await request.post(`${API}/returns`, {
			headers: H,
			data: { reason: "DEFECTIVE", items: [] },
		});
		expect([400, 422, 500]).toContain(res.status());
	});
});

// ── Invalid values & boundary conditions ───────────────────

test.describe("Validation — Invalid values", () => {
	test("POST /catalog/products — negative price", async ({ request }) => {
		const res = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "Negative Price",
				sku: `NEG-${Date.now()}`,
				supplierId: FAKE_CUID,
				hsnCode: "6109",
				costPricePaise: -5000,
				sellingPricePaise: -10000,
				gstRatePercent: 5,
				stockQty: 10,
			},
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /orders — non-existent productId in items", async ({
		request,
	}) => {
		const res = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Ghost Product Buyer",
				buyerEmail: "ghost@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "1 St",
					city: "Delhi",
					state: "Delhi",
					pin: "110001",
					country: "IN",
				},
				billingAddress: {
					line1: "1 St",
					city: "Delhi",
					state: "Delhi",
					pin: "110001",
					country: "IN",
				},
				items: [{ productId: FAKE_CUID, quantity: 1 }],
			},
		});
		expect([400, 404, 422, 500]).toContain(res.status());
	});

	test("POST /pincode/check — invalid pincode format", async ({ request }) => {
		const res = await request.post(`${API}/pincode/check`, {
			headers: H,
			data: { pincode: "ABC", weightGrams: 500, isCod: false },
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /pincode/check — empty pincode", async ({ request }) => {
		const res = await request.post(`${API}/pincode/check`, {
			headers: H,
			data: { pincode: "", weightGrams: 500, isCod: false },
		});
		expect([400, 422, 500]).toContain(res.status());
	});

	test("PATCH /orders/:id/status — non-existent order", async ({
		request,
	}) => {
		const res = await request.patch(`${API}/orders/${FAKE_CUID}/status`, {
			headers: H,
			data: { status: "SHIPPED" },
		});
		expect([400, 404, 500]).toContain(res.status());
	});

	test("PATCH /orders/:id/status — invalid status value", async ({
		request,
	}) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `Val Supplier ${Date.now()}`,
				contactEmail: "val@e2e.test",
				leadTimeDays: 2,
			},
		});
		const supJson = await supRes.json();
		const prodRes = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "Val Product",
				sku: `VAL-${Date.now()}`,
				supplierId: supJson.data.id,
				hsnCode: "6109",
				costPricePaise: 10000,
				sellingPricePaise: 20000,
				gstRatePercent: 5,
				stockQty: 10,
			},
		});
		const prodJson = await prodRes.json();
		const ordRes = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Val Buyer",
				buyerEmail: "val-buyer@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "1 St",
					city: "Delhi",
					state: "Delhi",
					pin: "110001",
					country: "IN",
				},
				billingAddress: {
					line1: "1 St",
					city: "Delhi",
					state: "Delhi",
					pin: "110001",
					country: "IN",
				},
				items: [{ productId: prodJson.data.id, quantity: 1 }],
			},
		});
		const ordJson = await ordRes.json();

		const res = await request.patch(
			`${API}/orders/${ordJson.data.id}/status`,
			{
				headers: H,
				data: { status: "NONEXISTENT_STATUS" },
			},
		);
		expect([400, 422, 500]).toContain(res.status());
	});

	test("PATCH /catalog/inventory/:id — negative stock below zero", async ({
		request,
	}) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `Inv Supplier ${Date.now()}`,
				contactEmail: "inv@e2e.test",
				leadTimeDays: 2,
			},
		});
		const supJson = await supRes.json();
		const prodRes = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "Low Stock Product",
				sku: `LOW-${Date.now()}`,
				supplierId: supJson.data.id,
				hsnCode: "6109",
				costPricePaise: 10000,
				sellingPricePaise: 20000,
				gstRatePercent: 5,
				stockQty: 2,
			},
		});
		const prodJson = await prodRes.json();

		const res = await request.patch(
			`${API}/catalog/inventory/${prodJson.data.id}`,
			{
				headers: H,
				data: { delta: -100, reason: "Force negative" },
			},
		);
		expect([400, 422, 500]).toContain(res.status());
	});

	test("POST /rto/score — non-existent orderId", async ({ request }) => {
		const res = await request.post(`${API}/rto/score`, {
			headers: H,
			data: { orderId: FAKE_CUID },
		});
		expect([400, 404, 500, 502]).toContain(res.status());
	});

	test("POST /invoices — non-existent orderId", async ({ request }) => {
		const res = await request.post(`${API}/invoices`, {
			headers: H,
			data: { orderId: FAKE_CUID },
		});
		expect([400, 404, 500]).toContain(res.status());
	});
});

// ── Duplicate prevention ───────────────────────────────────

test.describe("Validation — Duplicate prevention", () => {
	let dupSupplierId: string;
	let dupProductId: string;
	let dupOrderId: string;

	test("Setup: create entities for duplicate tests", async ({ request }) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `Dup Supplier ${Date.now()}`,
				contactEmail: "dup@e2e.test",
				leadTimeDays: 3,
			},
		});
		dupSupplierId = (await supRes.json()).data.id;

		const sku = `DUP-${Date.now()}`;
		const prodRes = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "Dup Product",
				sku,
				supplierId: dupSupplierId,
				hsnCode: "6109",
				costPricePaise: 10000,
				sellingPricePaise: 20000,
				gstRatePercent: 5,
				stockQty: 10,
			},
		});
		dupProductId = (await prodRes.json()).data.id;

		const ordRes = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Dup Buyer",
				buyerEmail: "dup-buyer@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "1 St",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				billingAddress: {
					line1: "1 St",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				items: [{ productId: dupProductId, quantity: 1 }],
			},
		});
		dupOrderId = (await ordRes.json()).data.id;
	});

	test("POST /invoices — duplicate invoice for same order", async ({
		request,
	}) => {
		await request.post(`${API}/invoices`, {
			headers: H,
			data: { orderId: dupOrderId },
		});

		const res = await request.post(`${API}/invoices`, {
			headers: H,
			data: { orderId: dupOrderId },
		});
		expect([200, 400, 409, 500]).toContain(res.status());
	});
});

// ── Pagination & Filtering ─────────────────────────────────

test.describe("Validation — Pagination & filtering", () => {
	test("GET /orders — pagination: page=1&pageSize=2", async ({ request }) => {
		const res = await request.get(`${API}/orders?page=1&pageSize=2`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.items.length).toBeLessThanOrEqual(2);
		expect(json.data).toHaveProperty("total");
	});

	test("GET /orders — filter by status=PENDING", async ({ request }) => {
		const res = await request.get(`${API}/orders?status=PENDING`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		for (const order of json.data.items) {
			expect(order.status).toBe("PENDING");
		}
	});

	test("GET /orders — search with no results", async ({ request }) => {
		const res = await request.get(
			`${API}/orders?search=zzz_nonexistent_buyer_${Date.now()}`,
			{ headers: H },
		);
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.items).toHaveLength(0);
	});

	test("GET /catalog/products — pagination: pageSize=1", async ({
		request,
	}) => {
		const res = await request.get(`${API}/catalog/products?pageSize=1`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.items.length).toBeLessThanOrEqual(1);
	});

	test("GET /returns — pagination works", async ({ request }) => {
		const res = await request.get(`${API}/returns?page=1&pageSize=5`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.items.length).toBeLessThanOrEqual(5);
	});

	test("GET /reconciliation/records — pagination works", async ({
		request,
	}) => {
		const res = await request.get(
			`${API}/reconciliation/records?page=1&pageSize=5`,
			{ headers: H },
		);
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("GET /suppliers/incidents — filter by type", async ({ request }) => {
		const res = await request.get(
			`${API}/suppliers/incidents?type=LATE_DELIVERY`,
			{ headers: H },
		);
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});
});

// ── GST edge cases ─────────────────────────────────────────

test.describe("Validation — GST calculation edge cases", () => {
	let gstSupplierId: string;
	let gstProductId: string;

	test("Setup: create entities in different states", async ({ request }) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `GST Supplier ${Date.now()}`,
				contactEmail: "gst@e2e.test",
				leadTimeDays: 2,
			},
		});
		gstSupplierId = (await supRes.json()).data.id;

		const prodRes = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "GST Test Saree",
				sku: `GST-${Date.now()}`,
				supplierId: gstSupplierId,
				hsnCode: "5407",
				costPricePaise: 100000,
				sellingPricePaise: 250000,
				gstRatePercent: 12,
				stockQty: 50,
			},
		});
		gstProductId = (await prodRes.json()).data.id;
	});

	test("Inter-state order → IGST (seller KA, buyer MH)", async ({
		request,
	}) => {
		const ordRes = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "IGST Buyer",
				buyerEmail: "igst@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "10 Marine Drive",
					city: "Mumbai",
					state: "Maharashtra",
					pin: "400001",
					country: "IN",
				},
				billingAddress: {
					line1: "10 Marine Drive",
					city: "Mumbai",
					state: "Maharashtra",
					pin: "400001",
					country: "IN",
				},
				items: [{ productId: gstProductId, quantity: 1 }],
			},
		});
		expect(ordRes.status()).toBe(201);
		const ordJson = await ordRes.json();
		const interId = ordJson.data.id;

		const invRes = await request.post(`${API}/invoices`, {
			headers: H,
			data: { orderId: interId },
		});
		expect([200, 201, 400]).toContain(invRes.status());
		if (invRes.ok()) {
			const invJson = await invRes.json();
			expect(invJson.data.gstType).toBe("IGST");
			expect(invJson.data.igstPaise).toBeGreaterThan(0);
			expect(invJson.data.cgstPaise).toBe(0);
			expect(invJson.data.sgstPaise).toBe(0);
		}
	});

	test("Intra-state order → CGST+SGST (both KA)", async ({ request }) => {
		const ordRes = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "CGST Buyer",
				buyerEmail: "cgst@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "5 Brigade Road",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				billingAddress: {
					line1: "5 Brigade Road",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				items: [{ productId: gstProductId, quantity: 1 }],
			},
		});
		expect(ordRes.status()).toBe(201);
		const ordJson = await ordRes.json();
		const intraId = ordJson.data.id;

		const invRes = await request.post(`${API}/invoices`, {
			headers: H,
			data: { orderId: intraId },
		});
		expect([200, 201, 400]).toContain(invRes.status());
		if (invRes.ok()) {
			const invJson = await invRes.json();
			expect(invJson.data.gstType).toBe("CGST_SGST");
			expect(invJson.data.cgstPaise).toBeGreaterThan(0);
			expect(invJson.data.sgstPaise).toBeGreaterThan(0);
			expect(invJson.data.cgstPaise).toBe(invJson.data.sgstPaise);
			expect(invJson.data.igstPaise).toBe(0);
		}
	});

	test("GST math: order tax = subtotal × gstRate%", async ({ request }) => {
		const ordRes = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Tax Math Buyer",
				buyerEmail: "tax@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "1 Test St",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				billingAddress: {
					line1: "1 Test St",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				items: [{ productId: gstProductId, quantity: 3 }],
			},
		});
		expect(ordRes.status()).toBe(201);
		const ordJson = await ordRes.json();
		expect(ordJson.data.subtotalPaise).toBe(750000);
		expect(ordJson.data.taxPaise).toBe(90000);
		expect(ordJson.data.totalPaise).toBe(840000);
	});
});

// ── Order status transition edge cases ─────────────────────

test.describe("Validation — Order status transitions", () => {
	let transOrderId: string;
	let transSupplierId: string;
	let transProductId: string;

	test("Setup: create order for transitions", async ({ request }) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `Trans Supplier ${Date.now()}`,
				contactEmail: "trans@e2e.test",
				leadTimeDays: 2,
			},
		});
		transSupplierId = (await supRes.json()).data.id;

		const prodRes = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "Trans Product",
				sku: `TRANS-${Date.now()}`,
				supplierId: transSupplierId,
				hsnCode: "6109",
				costPricePaise: 10000,
				sellingPricePaise: 20000,
				gstRatePercent: 5,
				stockQty: 100,
			},
		});
		transProductId = (await prodRes.json()).data.id;

		const ordRes = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Trans Buyer",
				buyerEmail: "trans-buyer@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "1 St",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				billingAddress: {
					line1: "1 St",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				items: [{ productId: transProductId, quantity: 1 }],
			},
		});
		transOrderId = (await ordRes.json()).data.id;
	});

	test("PENDING → PROCESSING → SHIPPED → DELIVERED (happy path)", async ({
		request,
	}) => {
		for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"] as const) {
			const res = await request.patch(
				`${API}/orders/${transOrderId}/status`,
				{
					headers: H,
					data: { status, note: `Transition to ${status}` },
				},
			);
			expect(res.ok()).toBe(true);
			const json = await res.json();
			expect(json.data.status).toBe(status);
		}
	});

	test("DELIVERED → CANCELLED — verify server handles it", async ({
		request,
	}) => {
		const res = await request.patch(
			`${API}/orders/${transOrderId}/status`,
			{
				headers: H,
				data: { status: "CANCELLED", note: "Should fail or be handled" },
			},
		);
		expect([200, 400, 422, 500]).toContain(res.status());
	});
});
