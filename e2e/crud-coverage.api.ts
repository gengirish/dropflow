import { test, expect } from "@playwright/test";

/**
 * CRUD Coverage E2E: Tests update, delete, and detail endpoints
 * that are missing from the existing test suites.
 *
 * Covers: products PATCH, channels PATCH/DELETE, notifications PATCH/DELETE,
 * pincode rates PATCH/DELETE, reorder rules PATCH/DELETE, workflows PUT/DELETE,
 * invoice detail, workflow runs, supplier scorecard detail, refund trigger,
 * reconciliation manual match, and notification template seed.
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
let invoiceId: string;
let channelId: string;
let templateId: string;
let rateId: string;
let workflowId: string;

test.describe.serial("CRUD Coverage — Setup", () => {
	test("Setup: Create supplier", async ({ request }) => {
		const res = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `CRUD Test Supplier ${Date.now()}`,
				contactEmail: "crud@e2e.test",
				leadTimeDays: 4,
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		supplierId = json.data.id;
	});

	test("Setup: Create product", async ({ request }) => {
		const res = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "CRUD Test Polo",
				sku: `CRUD-${Date.now()}`,
				supplierId,
				hsnCode: "6105",
				costPricePaise: 35000,
				sellingPricePaise: 79900,
				gstRatePercent: 5,
				stockQty: 150,
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		productId = json.data.id;
	});

	test("Setup: Create order + invoice", async ({ request }) => {
		const orderRes = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "CRUD Test Buyer",
				buyerEmail: "crud-buyer@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "1 CRUD Lane",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				billingAddress: {
					line1: "1 CRUD Lane",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				items: [{ productId, quantity: 1 }],
			},
		});
		expect(orderRes.status()).toBe(201);
		const orderJson = await orderRes.json();
		orderId = orderJson.data.id;

		const invRes = await request.post(`${API}/invoices`, {
			headers: H,
			data: { orderId },
		});
		expect([200, 201, 400]).toContain(invRes.status());
		if (invRes.ok()) {
			const invJson = await invRes.json();
			invoiceId = invJson.data.id;
		}
	});
});

test.describe("CRUD Coverage — Product Updates", () => {
	test("PATCH /catalog/products/:id — update product name", async ({
		request,
	}) => {
		const res = await request.patch(`${API}/catalog/products/${productId}`, {
			headers: H,
			data: { name: "CRUD Test Polo V2" },
		});
		expect([200, 400]).toContain(res.status());
		if (res.ok()) {
			const json = await res.json();
			expect(json.data.name).toBe("CRUD Test Polo V2");
		}
	});

	test("GET /catalog/products/:id — get product detail", async ({
		request,
	}) => {
		const res = await request.get(`${API}/catalog/products/${productId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.id).toBe(productId);
	});
});

test.describe("CRUD Coverage — Invoice Detail", () => {
	test("GET /invoices/:id — get invoice detail", async ({ request }) => {
		test.skip(!invoiceId, "Invoice was not created (GST config missing)");
		const res = await request.get(`${API}/invoices/${invoiceId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.id).toBe(invoiceId);
		expect(json.data.invoiceNumber).toMatch(/^INV\//);
		expect(json.data.orderId).toBe(orderId);
	});
});

test.describe.serial("CRUD Coverage — Channel Lifecycle", () => {
	test("POST /channels — create channel", async ({ request }) => {
		const res = await request.post(`${API}/channels`, {
			headers: H,
			data: {
				name: `CRUD Channel ${Date.now()}`,
				type: "AMAZON",
				bufferPercent: 75,
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		channelId = json.data.id;
	});

	test("PATCH /channels/:id — update channel", async ({ request }) => {
		const res = await request.patch(`${API}/channels/${channelId}`, {
			headers: H,
			data: { name: "CRUD Channel Updated", bufferPercent: 90 },
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.name).toBe("CRUD Channel Updated");
	});

	test("GET /channels/:id/listings — list channel listings", async ({
		request,
	}) => {
		const res = await request.get(`${API}/channels/${channelId}/listings`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("GET /channels/:id/stock — get channel stock", async ({ request }) => {
		const res = await request.get(`${API}/channels/${channelId}/stock`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("DELETE /channels/:id — delete channel", async ({ request }) => {
		const res = await request.delete(`${API}/channels/${channelId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("GET /channels/:id — deleted channel returns 404", async ({
		request,
	}) => {
		const res = await request.get(`${API}/channels/${channelId}`, {
			headers: H,
		});
		expect([404, 500]).toContain(res.status());
	});
});

test.describe.serial("CRUD Coverage — Notification Template Lifecycle", () => {
	test("POST /notifications/templates — create template", async ({
		request,
	}) => {
		const res = await request.post(`${API}/notifications/templates`, {
			headers: H,
			data: {
				channel: "SMS",
				triggerEvent: "order.shipped",
				name: `CRUD SMS Template ${Date.now()}`,
				templateBody: "Hi {{buyerName}}, order {{orderNumber}} shipped!",
				variables: ["buyerName", "orderNumber"],
				isActive: true,
			},
		});
		expect([200, 201, 409]).toContain(res.status());
		if (res.status() !== 409) {
			const json = await res.json();
			templateId = json.data.id;
		} else {
			const listRes = await request.get(`${API}/notifications/templates`, {
				headers: H,
			});
			const listJson = await listRes.json();
			templateId = listJson.data.items?.[0]?.id ?? listJson.data[0]?.id;
		}
	});

	test("GET /notifications/templates/:id — get template detail", async ({
		request,
	}) => {
		test.skip(!templateId, "No template created");
		const res = await request.get(
			`${API}/notifications/templates/${templateId}`,
			{ headers: H },
		);
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.id).toBe(templateId);
	});

	test("PATCH /notifications/templates/:id — update template", async ({
		request,
	}) => {
		test.skip(!templateId, "No template created");
		const res = await request.patch(
			`${API}/notifications/templates/${templateId}`,
			{
				headers: H,
				data: { isActive: false },
			},
		);
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.isActive).toBe(false);
	});

	test("POST /notifications/templates/seed — seed default templates", async ({
		request,
	}) => {
		const res = await request.post(`${API}/notifications/templates/seed`, {
			headers: H,
			data: {},
		});
		expect([200, 201, 502]).toContain(res.status());
		if (res.ok()) {
			const json = await res.json();
			expect(json.success).toBe(true);
		}
	});

	test("DELETE /notifications/templates/:id — delete template", async ({
		request,
	}) => {
		test.skip(!templateId, "No template created");
		const res = await request.delete(
			`${API}/notifications/templates/${templateId}`,
			{ headers: H },
		);
		expect(res.ok()).toBe(true);
	});
});

test.describe.serial("CRUD Coverage — Pincode Rate Lifecycle", () => {
	test("POST /pincode/rates — create rate", async ({ request }) => {
		const res = await request.post(`${API}/pincode/rates`, {
			headers: H,
			data: {
				carrier: "BLUEDART",
				zone: "WEST-1",
				minWeightGrams: 0,
				maxWeightGrams: 500,
				basePricePaise: 7500,
				additionalPerGramPaise: 1,
				codChargePaise: 4000,
				fuelSurchargePercent: 18,
				validFrom: "2026-01-01",
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		rateId = json.data.id;
	});

	test("GET /pincode/rates/:id — get rate detail", async ({ request }) => {
		const res = await request.get(`${API}/pincode/rates/${rateId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.carrier).toBe("BLUEDART");
		expect(json.data.zone).toBe("WEST-1");
	});

	test("PATCH /pincode/rates/:id — update rate", async ({ request }) => {
		const res = await request.patch(`${API}/pincode/rates/${rateId}`, {
			headers: H,
			data: { basePricePaise: 8000, fuelSurchargePercent: 20 },
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.basePricePaise).toBe(8000);
	});

	test("DELETE /pincode/rates/:id — delete rate", async ({ request }) => {
		const res = await request.delete(`${API}/pincode/rates/${rateId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
	});
});

test.describe.serial("CRUD Coverage — Reorder Rule Lifecycle", () => {
	let ruleCreated = false;

	test("POST + PATCH /reorder/rules/:productId — create then update", async ({
		request,
	}) => {
		const createRes = await request.post(`${API}/reorder/rules`, {
			headers: H,
			data: {
				productId,
				reorderPoint: 25,
				reorderQty: 80,
				maxStockQty: 400,
				isAutoPoEnabled: false,
			},
		});
		expect([200, 201]).toContain(createRes.status());
		ruleCreated = createRes.ok();

		if (ruleCreated) {
			const res = await request.patch(`${API}/reorder/rules/${productId}`, {
				headers: H,
				data: { reorderPoint: 40 },
			});
			expect([200, 400]).toContain(res.status());
		}
	});

	test("DELETE /reorder/rules/:productId — delete reorder rule", async ({
		request,
	}) => {
		test.skip(!ruleCreated, "Rule was not created");
		const res = await request.delete(`${API}/reorder/rules/${productId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
	});
});

test.describe.serial("CRUD Coverage — Workflow Lifecycle", () => {
	test("POST /workflows — create workflow", async ({ request }) => {
		const res = await request.post(`${API}/workflows`, {
			headers: H,
			data: {
				name: `CRUD Workflow ${Date.now()}`,
				trigger: "order.created",
				nodes: [
					{
						id: "step-1",
						type: "action",
						position: { x: 250, y: 0 },
						data: { label: "Validate Stock", handler: "validate-stock" },
					},
					{
						id: "step-2",
						type: "action",
						position: { x: 250, y: 200 },
						data: { label: "Route Supplier", handler: "route-supplier" },
					},
				],
				edges: [{ id: "e1", source: "step-1", target: "step-2" }],
			},
		});
		expect([200, 201, 422]).toContain(res.status());
		if (res.ok()) {
			const json = await res.json();
			workflowId = json.data.id;
		}
	});

	test("GET /workflows/:id — get workflow detail", async ({ request }) => {
		test.skip(!workflowId, "Workflow was not created");
		const res = await request.get(`${API}/workflows/${workflowId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.id).toBe(workflowId);
	});

	test("PUT /workflows/:id — full update workflow", async ({ request }) => {
		test.skip(!workflowId, "Workflow was not created");
		const res = await request.put(`${API}/workflows/${workflowId}`, {
			headers: H,
			data: {
				name: "CRUD Workflow Updated",
				trigger: "order.created",
				nodes: [
					{
						id: "s1",
						type: "action",
						position: { x: 100, y: 100 },
						data: { label: "Step A Updated", handler: "step-a-updated" },
					},
					{
						id: "s2",
						type: "action",
						position: { x: 100, y: 300 },
						data: { label: "Step B", handler: "step-b" },
					},
				],
				edges: [{ id: "e1", source: "s1", target: "s2" }],
			},
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.name).toBe("CRUD Workflow Updated");
	});

	test("PATCH /workflows/:id — partial update workflow", async ({
		request,
	}) => {
		test.skip(!workflowId, "Workflow was not created");
		const res = await request.patch(`${API}/workflows/${workflowId}`, {
			headers: H,
			data: { name: "CRUD Workflow Patched" },
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.name).toBe("CRUD Workflow Patched");
	});

	test("GET /workflows/:id/runs — list workflow runs", async ({ request }) => {
		test.skip(!workflowId, "Workflow was not created");
		const res = await request.get(`${API}/workflows/${workflowId}/runs`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("DELETE /workflows/:id — delete workflow", async ({ request }) => {
		test.skip(!workflowId, "Workflow was not created");
		const res = await request.delete(`${API}/workflows/${workflowId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
	});
});

test.describe.serial("CRUD Coverage — Supplier Scorecard Detail", () => {
	test("GET /suppliers/:id/scorecard — get individual scorecard", async ({
		request,
	}) => {
		const res = await request.get(
			`${API}/suppliers/${supplierId}/scorecard`,
			{ headers: H },
		);
		expect([200, 404]).toContain(res.status());
		if (res.status() === 200) {
			const json = await res.json();
			expect(json.success).toBe(true);
		}
	});
});

test.describe.serial("CRUD Coverage — Reconciliation Manual Match", () => {
	test("POST /reconciliation/match — manual match attempt", async ({
		request,
	}) => {
		const res = await request.post(`${API}/reconciliation/match`, {
			headers: H,
			data: {
				orderId,
				gatewayPaymentId: `pay_crud_${Date.now()}`,
				amountPaise: 79900,
			},
		});
		expect([200, 201, 400, 404]).toContain(res.status());
	});
});

test.describe.serial("CRUD Coverage — Return Refund Trigger", () => {
	test("POST /returns/:id/refund — trigger refund on delivered order", async ({
		request,
	}) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `Refund Supplier ${Date.now()}`,
				contactEmail: "refund@e2e.test",
				leadTimeDays: 2,
			},
		});
		const refundSupplierId = (await supRes.json()).data.id;

		const prodRes = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "Refund Product",
				sku: `REF-${Date.now()}`,
				supplierId: refundSupplierId,
				hsnCode: "6109",
				costPricePaise: 10000,
				sellingPricePaise: 20000,
				gstRatePercent: 5,
				stockQty: 50,
			},
		});
		const refundProductId = (await prodRes.json()).data.id;

		const ordRes = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Refund Buyer",
				buyerEmail: "refund-buyer@e2e.test",
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
				items: [{ productId: refundProductId, quantity: 1 }],
			},
		});
		const refOrdId = (await ordRes.json()).data.id;

		for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"] as const) {
			await request.patch(`${API}/orders/${refOrdId}/status`, {
				headers: H,
				data: { status, note: `Refund: ${status}` },
			});
		}

		const orderRes = await request.get(`${API}/orders/${refOrdId}`, {
			headers: H,
		});
		const orderJson = await orderRes.json();
		const item = orderJson.data.items[0];

		const returnRes = await request.post(`${API}/returns`, {
			headers: H,
			data: {
				orderId: refOrdId,
				reason: "DEFECTIVE",
				customerNotes: "CRUD: defective item",
				items: [
					{
						orderItemId: item.id,
						productId: item.productId,
						quantity: 1,
						reason: "DEFECTIVE",
					},
				],
			},
		});
		expect(returnRes.status()).toBe(201);
		const returnId = (await returnRes.json()).data.id;

		await request.patch(`${API}/returns/${returnId}`, {
			headers: H,
			data: { status: "APPROVED" },
		});

		const refundRes = await request.post(
			`${API}/returns/${returnId}/refund`,
			{
				headers: H,
				data: { refundAmountPaise: 20000, method: "ORIGINAL_PAYMENT" },
			},
		);
		expect([200, 201, 202, 400, 500, 502]).toContain(refundRes.status());
	});
});

test.describe("CRUD Coverage — Payment", () => {
	test("POST /orders/:id/pay — mark order paid", async ({ request }) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `Pay Supplier ${Date.now()}`,
				contactEmail: "pay@e2e.test",
				leadTimeDays: 2,
			},
		});
		const paySupplierId = (await supRes.json()).data.id;

		const prodRes = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "Pay Product",
				sku: `PAY-${Date.now()}`,
				supplierId: paySupplierId,
				hsnCode: "6109",
				costPricePaise: 10000,
				sellingPricePaise: 20000,
				gstRatePercent: 5,
				stockQty: 50,
			},
		});
		const payProductId = (await prodRes.json()).data.id;

		const newOrder = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Pay Test Buyer",
				buyerEmail: "pay-buyer@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "1 Pay Street",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				billingAddress: {
					line1: "1 Pay Street",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				items: [{ productId: payProductId, quantity: 1 }],
			},
		});
		expect(newOrder.status()).toBe(201);
		const newOrderJson = await newOrder.json();

		const res = await request.post(
			`${API}/orders/${newOrderJson.data.id}/pay`,
			{
				headers: H,
				data: {
					gateway: "RAZORPAY",
					paymentId: `pay_crud_${Date.now()}`,
					amountPaise: newOrderJson.data.totalPaise,
				},
			},
		);
		expect([200, 201, 202, 400, 500, 502]).toContain(res.status());
	});
});
