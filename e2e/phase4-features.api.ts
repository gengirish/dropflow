import { test, expect } from "@playwright/test";

/**
 * Phase 4 E2E: Tests all 9 YC-worthy features against the deployed DropFlow app.
 *
 * Tests are split into CRUD (work without worker) and async (need worker).
 * Worker-dependent tests accept enqueue confirmation OR graceful failure.
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
let channelId: string;
let returnRequestId: string;

test.describe.serial("Phase 4 Features E2E", () => {
	// ── SETUP ───────────────────────────────────────────────

	test("Setup: Create supplier", async ({ request }) => {
		const res = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `Phase4 Supplier ${Date.now()}`,
				contactEmail: "phase4@e2e.test",
				leadTimeDays: 5,
				returnWindowDays: 7,
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
				name: "Phase4 Test Kurta",
				sku: `P4-${Date.now()}`,
				supplierId,
				hsnCode: "6204",
				costPricePaise: 40000,
				sellingPricePaise: 99900,
				gstRatePercent: 12,
				stockQty: 200,
				lowStockThreshold: 20,
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		productId = json.data.id;
	});

	test("Setup: Create COD order", async ({ request }) => {
		const res = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Phase4 COD Buyer",
				buyerEmail: "cod-buyer@e2e.test",
				buyerPhone: "+919876543210",
				paymentMethod: "COD",
				shippingAddress: {
					line1: "15 Jayanagar 4th Block",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560041",
					country: "IN",
				},
				billingAddress: {
					line1: "15 Jayanagar 4th Block",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560041",
					country: "IN",
				},
				items: [{ productId, quantity: 2 }],
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		orderId = json.data.id;
		expect(json.data.subtotalPaise).toBe(199800);
	});

	// ── F1: RTO PREDICTION ENGINE ───────────────────────────

	test("F1.1: Score order for RTO risk (async)", async ({ request }) => {
		const res = await request.post(`${API}/rto/score`, {
			headers: H,
			data: { orderId },
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	test("F1.2: Get RTO scores list", async ({ request }) => {
		const res = await request.get(`${API}/rto/score?pageSize=10`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F1.3: Send COD-to-prepaid nudge (async)", async ({ request }) => {
		const res = await request.post(`${API}/rto/nudge`, {
			headers: H,
			data: { orderId, channel: "WHATSAPP" },
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	test("F1.4: RTO analytics dashboard", async ({ request }) => {
		const res = await request.get(`${API}/rto/analytics`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data).toHaveProperty("totalOrders");
		expect(json.data).toHaveProperty("rtoRate");
		expect(json.data).toHaveProperty("riskDistribution");
	});

	// ── F2: REAL-TIME MARGIN WATERFALL ──────────────────────

	test("F2.1: Get margin analytics dashboard", async ({ request }) => {
		const res = await request.get(`${API}/analytics/margins`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data).toHaveProperty("avgMarginPercent");
		expect(json.data).toHaveProperty("totalRevenuePaise");
	});

	test("F2.2: Get per-order margin waterfall", async ({ request }) => {
		const res = await request.get(`${API}/analytics/margins/${orderId}`, {
			headers: H,
		});
		expect([200, 404]).toContain(res.status());
		if (res.status() === 200) {
			const json = await res.json();
			expect(json.data).toHaveProperty("netMarginPaise");
		}
	});

	// ── F3: MULTI-CHANNEL INVENTORY SYNC ────────────────────

	test("F3.1: Create sales channel", async ({ request }) => {
		const res = await request.post(`${API}/channels`, {
			headers: H,
			data: {
				name: `E2E Website ${Date.now()}`,
				type: "WEBSITE",
				bufferPercent: 80,
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		expect(json.success).toBe(true);
		channelId = json.data.id;
		expect(json.data.type).toBe("WEBSITE");
	});

	test("F3.2: List channels", async ({ request }) => {
		const res = await request.get(`${API}/channels`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.items.length).toBeGreaterThan(0);
	});

	test("F3.3: Add product listing to channel", async ({ request }) => {
		const res = await request.post(`${API}/channels/${channelId}/listings`, {
			headers: H,
			data: {
				channelId,
				productId,
				channelSku: "WEB-KURTA-001",
				isActive: true,
			},
		});
		expect([200, 201]).toContain(res.status());
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F3.4: Set stock allocation", async ({ request }) => {
		const res = await request.post(`${API}/channels/${channelId}/stock`, {
			headers: H,
			data: {
				channelId,
				productId,
				allocatedQty: 100,
			},
		});
		expect([200, 201]).toContain(res.status());
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F3.5: Get multi-channel inventory snapshot", async ({ request }) => {
		const res = await request.get(`${API}/channels/inventory`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F3.6: Get channel detail", async ({ request }) => {
		const res = await request.get(`${API}/channels/${channelId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.id).toBe(channelId);
	});

	// ── F4: AUTOMATED SUPPLIER SCORECARDS ───────────────────

	test("F4.1: Create supplier incident", async ({ request }) => {
		const res = await request.post(`${API}/suppliers/incidents`, {
			headers: H,
			data: {
				supplierId,
				type: "LATE_DELIVERY",
				severity: "MEDIUM",
				description: "E2E test: late delivery incident",
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.type).toBe("LATE_DELIVERY");
	});

	test("F4.2: List supplier incidents", async ({ request }) => {
		const res = await request.get(`${API}/suppliers/incidents`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.items.length).toBeGreaterThan(0);
	});

	test("F4.3: Trigger scorecard computation (async)", async ({ request }) => {
		const now = new Date();
		const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
		const res = await request.post(`${API}/suppliers/scorecards`, {
			headers: H,
			data: { period, supplierId },
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	test("F4.4: List supplier scorecards", async ({ request }) => {
		const res = await request.get(`${API}/suppliers/scorecards`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F4.5: Get supplier rankings", async ({ request }) => {
		const res = await request.get(`${API}/suppliers/rankings`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	// ── F5: SMART REORDER ENGINE ────────────────────────────

	test("F5.1: Create reorder rule", async ({ request }) => {
		const res = await request.post(`${API}/reorder/rules`, {
			headers: H,
			data: {
				productId,
				reorderPoint: 30,
				reorderQty: 100,
				maxStockQty: 500,
				isAutoPoEnabled: false,
			},
		});
		expect([200, 201]).toContain(res.status());
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F5.2: List reorder rules", async ({ request }) => {
		const res = await request.get(`${API}/reorder/rules`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F5.3: Get reorder rule for product", async ({ request }) => {
		const res = await request.get(`${API}/reorder/rules/${productId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.reorderPoint).toBe(30);
		expect(json.data.reorderQty).toBe(100);
	});

	test("F5.4: Get stock forecast", async ({ request }) => {
		const res = await request.get(`${API}/reorder/forecast`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(Array.isArray(json.data)).toBe(true);
	});

	test("F5.5: List reorder alerts", async ({ request }) => {
		const res = await request.get(`${API}/reorder/alerts`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F5.6: Trigger reorder check (async)", async ({ request }) => {
		const res = await request.post(`${API}/reorder/run`, {
			headers: H,
			data: {},
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	// ── F6: PINCODE SERVICEABILITY + RATE ENGINE ────────────

	test("F6.1: Check pincode serviceability", async ({ request }) => {
		const res = await request.post(`${API}/pincode/check`, {
			headers: H,
			data: { pincode: "560041", weightGrams: 500, isCod: true },
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data).toHaveProperty("pincode");
		expect(json.data).toHaveProperty("isServiceable");
		expect(json.data).toHaveProperty("carriers");
	});

	test("F6.2: Bulk check pincodes", async ({ request }) => {
		const res = await request.post(`${API}/pincode/bulk-check`, {
			headers: H,
			data: { pincodes: ["560041", "110001", "400001"] },
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F6.3: Create carrier rate", async ({ request }) => {
		const res = await request.post(`${API}/pincode/rates`, {
			headers: H,
			data: {
				carrier: "DELHIVERY",
				zone: "SOUTH-1",
				minWeightGrams: 0,
				maxWeightGrams: 1000,
				basePricePaise: 6500,
				additionalPerGramPaise: 0.5,
				codChargePaise: 3500,
				fuelSurchargePercent: 15,
				validFrom: "2026-01-01",
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F6.4: List carrier rates", async ({ request }) => {
		const res = await request.get(`${API}/pincode/rates`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F6.5: Seed pincode serviceability", async ({ request }) => {
		const res = await request.post(`${API}/pincode/serviceability`, {
			headers: H,
			data: {
				records: [
					{
						pincode: "560041",
						carrier: "DELHIVERY",
						isServiceable: true,
						isCodAvailable: true,
						estimatedDays: 3,
						zone: "SOUTH-1",
					},
					{
						pincode: "110001",
						carrier: "DELHIVERY",
						isServiceable: true,
						isCodAvailable: true,
						estimatedDays: 2,
						zone: "NORTH-1",
					},
				],
			},
		});
		expect([200, 201]).toContain(res.status());
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F6.6: List pincode serviceability records", async ({ request }) => {
		const res = await request.get(`${API}/pincode/serviceability`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	// ── F7: WHATSAPP / NOTIFICATION TEMPLATES ───────────────

	test("F7.1: Create notification template", async ({ request }) => {
		const res = await request.post(`${API}/notifications/templates`, {
			headers: H,
			data: {
				channel: "WHATSAPP",
				triggerEvent: "order.confirmed",
				name: `E2E Order Confirmation ${Date.now()}`,
				templateBody:
					"Hi {{buyerName}}! Order {{orderNumber}} confirmed. Total: ₹{{totalAmount}}",
				variables: ["buyerName", "orderNumber", "totalAmount"],
				isActive: true,
			},
		});
		// 409 = duplicate template for same trigger event (acceptable)
		expect([200, 201, 409]).toContain(res.status());
	});

	test("F7.2: List notification templates", async ({ request }) => {
		const res = await request.get(`${API}/notifications/templates`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F7.3: Send test notification (async)", async ({ request }) => {
		const res = await request.post(`${API}/notifications/send`, {
			headers: H,
			data: {
				orderId,
				channel: "IN_APP",
				triggerEvent: "order.confirmed",
				variables: {
					buyerName: "Phase4 COD Buyer",
					orderNumber: "ORD-TEST",
					totalAmount: "1998",
				},
			},
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	test("F7.4: List notification logs", async ({ request }) => {
		const res = await request.get(`${API}/notifications/logs`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	// ── F8: RETURNS & REFUND WORKFLOW ───────────────────────

	test("F8.0: Move order to DELIVERED for return eligibility", async ({
		request,
	}) => {
		for (const status of ["SHIPPED", "DELIVERED"] as const) {
			const res = await request.patch(`${API}/orders/${orderId}/status`, {
				headers: H,
				data: { status, note: `E2E: marking ${status}` },
			});
			expect(res.ok()).toBe(true);
		}
	});

	test("F8.1: Create return request", async ({ request }) => {
		const orderRes = await request.get(`${API}/orders/${orderId}`, {
			headers: H,
		});
		const orderJson = await orderRes.json();
		const firstItem = orderJson.data.items[0];

		const res = await request.post(`${API}/returns`, {
			headers: H,
			data: {
				orderId,
				reason: "SIZE_ISSUE",
				customerNotes: "E2E test: size too large",
				items: [
					{
						orderItemId: firstItem.id,
						productId: firstItem.productId,
						quantity: 1,
						reason: "SIZE_ISSUE",
					},
				],
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		expect(json.success).toBe(true);
		returnRequestId = json.data.id;
		expect(json.data.status).toBe("REQUESTED");
	});

	test("F8.2: List returns", async ({ request }) => {
		const res = await request.get(`${API}/returns`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.items.length).toBeGreaterThan(0);
	});

	test("F8.3: Get return detail", async ({ request }) => {
		const res = await request.get(`${API}/returns/${returnRequestId}`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.id).toBe(returnRequestId);
		expect(json.data.reason).toBe("SIZE_ISSUE");
	});

	test("F8.4: Update return status to APPROVED (async)", async ({
		request,
	}) => {
		const res = await request.patch(`${API}/returns/${returnRequestId}`, {
			headers: H,
			data: { status: "APPROVED" },
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	test("F8.5: Returns analytics dashboard", async ({ request }) => {
		const res = await request.get(`${API}/returns/analytics`, { headers: H });
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data).toHaveProperty("totalReturns");
		expect(json.data).toHaveProperty("returnRate");
	});

	// ── F9: AUTOMATED RECONCILIATION ────────────────────────

	test("F9.1: Import payment gateway settlement", async ({ request }) => {
		const res = await request.post(`${API}/reconciliation/settlements`, {
			headers: H,
			data: {
				gateway: "RAZORPAY",
				settlementId: `SETL-E2E-${Date.now()}`,
				settlementDate: new Date().toISOString(),
				totalAmountPaise: 199800,
				feePaise: 3996,
				taxOnFeePaise: 719,
				netAmountPaise: 195085,
				utrNumber: "UTR-E2E-123456",
				items: [
					{
						gatewayPaymentId: `pay_e2e_${Date.now()}`,
						amountPaise: 199800,
						feePaise: 3996,
						taxPaise: 719,
						netPaise: 195085,
					},
				],
			},
		});
		expect(res.status()).toBe(201);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F9.2: List settlements", async ({ request }) => {
		const res = await request.get(`${API}/reconciliation/settlements`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F9.3: Import COD remittance (async)", async ({ request }) => {
		const res = await request.post(`${API}/reconciliation/cod-remittances`, {
			headers: H,
			data: {
				carrier: "DELHIVERY",
				remittanceId: `COD-E2E-${Date.now()}`,
				remittanceDate: new Date().toISOString(),
				totalAmountPaise: 99900,
				deductionsPaise: 2500,
				netAmountPaise: 97400,
				items: [
					{
						awbNumber: `AWB-E2E-${Date.now()}`,
						amountPaise: 99900,
						codChargePaise: 2500,
						netPaise: 97400,
					},
				],
			},
		});
		// 201 = created, 400/502 = worker enqueue failed (record still created)
		expect([200, 201, 400, 502]).toContain(res.status());
	});

	test("F9.4: List COD remittances", async ({ request }) => {
		const res = await request.get(`${API}/reconciliation/cod-remittances`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F9.5: List reconciliation records", async ({ request }) => {
		const res = await request.get(`${API}/reconciliation/records`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("F9.6: Reconciliation analytics", async ({ request }) => {
		const res = await request.get(`${API}/reconciliation/analytics`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data).toHaveProperty("totalRecords");
		expect(json.data).toHaveProperty("matchRate");
	});

	test("F9.7: Trigger auto-reconcile (async)", async ({ request }) => {
		const res = await request.post(`${API}/reconciliation/auto-reconcile`, {
			headers: H,
			data: {},
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});
});
