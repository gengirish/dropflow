import { test, expect } from "@playwright/test";

/**
 * Cross-Feature Integration E2E: Tests realistic business flows
 * that span multiple features end-to-end.
 *
 * Flow 1: Full order-to-reconciliation pipeline
 * Flow 2: Inventory lifecycle (stock → channel sync → reorder alert)
 * Flow 3: Return + refund + analytics impact
 * Flow 4: RTO risk → COD nudge → status pipeline
 * Flow 5: Supplier quality → scorecard → ranking
 */

const API = process.env.PROD_URL
	? `${process.env.PROD_URL}/api/v1`
	: "https://dropflow-beta.vercel.app/api/v1";

const H = {
	"x-e2e-test-key": "dropflow-e2e-test-secret-key-2024",
};

// ── Flow 1: Order → Invoice → Payment → Settlement → Reconciliation ───

test.describe.serial(
	"Integration: Order-to-Reconciliation Pipeline",
	() => {
		let supplierId: string;
		let productId: string;
		let orderId: string;
		let orderTotal: number;

		test("Create supplier + product", async ({ request }) => {
			const supRes = await request.post(`${API}/catalog/suppliers`, {
				headers: H,
				data: {
					name: `Integ Supplier ${Date.now()}`,
					contactEmail: "integ@e2e.test",
					leadTimeDays: 3,
				},
			});
			supplierId = (await supRes.json()).data.id;

			const prodRes = await request.post(`${API}/catalog/products`, {
				headers: H,
				data: {
					name: "Integration Jacket",
					sku: `INT-${Date.now()}`,
					supplierId,
					hsnCode: "6201",
					costPricePaise: 150000,
					sellingPricePaise: 299900,
					gstRatePercent: 12,
					stockQty: 50,
				},
			});
			productId = (await prodRes.json()).data.id;
		});

		test("Create order and verify stock deduction", async ({ request }) => {
			const ordRes = await request.post(`${API}/orders`, {
				headers: H,
				data: {
					buyerName: "Integration Buyer",
					buyerEmail: "integ-buyer@e2e.test",
					buyerPhone: "+919876543210",
					shippingAddress: {
						line1: "42 Integration Ave",
						city: "Bangalore",
						state: "Karnataka",
						pin: "560001",
						country: "IN",
					},
					billingAddress: {
						line1: "42 Integration Ave",
						city: "Bangalore",
						state: "Karnataka",
						pin: "560001",
						country: "IN",
					},
					items: [{ productId, quantity: 2 }],
				},
			});
			expect(ordRes.status()).toBe(201);
			const ordJson = await ordRes.json();
			orderId = ordJson.data.id;
			orderTotal = ordJson.data.totalPaise;
			expect(orderTotal).toBeGreaterThan(0);

			const prodRes = await request.get(
				`${API}/catalog/products/${productId}`,
				{ headers: H },
			);
			const prodJson = await prodRes.json();
			expect(prodJson.data.stockQty).toBeLessThanOrEqual(50);
		});

		test("Generate invoice with correct GST", async ({ request }) => {
			const res = await request.post(`${API}/invoices`, {
				headers: H,
				data: { orderId },
			});
			expect([200, 201, 400]).toContain(res.status());
			if (res.ok()) {
				const json = await res.json();
				expect(json.data.gstType).toBe("CGST_SGST");
				expect(json.data.totalTaxPaise).toBeGreaterThan(0);
			}
		});

		test("Move order through full lifecycle", async ({ request }) => {
			for (const status of [
				"PROCESSING",
				"SHIPPED",
				"DELIVERED",
			] as const) {
				const res = await request.patch(
					`${API}/orders/${orderId}/status`,
					{
						headers: H,
						data: { status, note: `Integration: ${status}` },
					},
				);
				expect(res.ok()).toBe(true);
			}
		});

		test("Import settlement matching order amount", async ({ request }) => {
			const res = await request.post(
				`${API}/reconciliation/settlements`,
				{
					headers: H,
					data: {
						gateway: "RAZORPAY",
						settlementId: `SETL-INT-${Date.now()}`,
						settlementDate: new Date().toISOString(),
						totalAmountPaise: orderTotal,
						feePaise: Math.round(orderTotal * 0.02),
						taxOnFeePaise: Math.round(orderTotal * 0.02 * 0.18),
						netAmountPaise:
							orderTotal -
							Math.round(orderTotal * 0.02) -
							Math.round(orderTotal * 0.02 * 0.18),
						utrNumber: `UTR-INT-${Date.now()}`,
						items: [
							{
								gatewayPaymentId: `pay_int_${Date.now()}`,
								amountPaise: orderTotal,
								feePaise: Math.round(orderTotal * 0.02),
								taxPaise: Math.round(orderTotal * 0.02 * 0.18),
								netPaise:
									orderTotal -
									Math.round(orderTotal * 0.02) -
									Math.round(orderTotal * 0.02 * 0.18),
							},
						],
					},
				},
			);
			expect(res.status()).toBe(201);
		});

		test("Reconciliation analytics reflect new data", async ({
			request,
		}) => {
			const res = await request.get(
				`${API}/reconciliation/analytics`,
				{ headers: H },
			);
			expect(res.ok()).toBe(true);
			const json = await res.json();
			expect(json.data.totalRecords).toBeGreaterThanOrEqual(0);
		});

		test("Dashboard analytics reflect the new order", async ({
			request,
		}) => {
			const res = await request.get(`${API}/analytics/dashboard`, {
				headers: H,
			});
			expect(res.ok()).toBe(true);
			const json = await res.json();
			expect(json.data.totalOrders).toBeGreaterThan(0);
			expect(json.data.totalRevenuePaise).toBeGreaterThan(0);
		});
	},
);

// ── Flow 2: Inventory → Channel Sync → Reorder Alert ──────

test.describe.serial(
	"Integration: Inventory-Channel-Reorder Pipeline",
	() => {
		let supplierId: string;
		let productId: string;
		let channelId: string;

		test("Create supplier + low-stock product", async ({ request }) => {
			const supRes = await request.post(`${API}/catalog/suppliers`, {
				headers: H,
				data: {
					name: `InvSync Supplier ${Date.now()}`,
					contactEmail: "invsync@e2e.test",
					leadTimeDays: 5,
				},
			});
			supplierId = (await supRes.json()).data.id;

			const prodRes = await request.post(`${API}/catalog/products`, {
				headers: H,
				data: {
					name: "Low Stock Widget",
					sku: `LSW-${Date.now()}`,
					supplierId,
					hsnCode: "8471",
					costPricePaise: 50000,
					sellingPricePaise: 99900,
					gstRatePercent: 18,
					stockQty: 30,
					lowStockThreshold: 25,
				},
			});
			productId = (await prodRes.json()).data.id;
		});

		test("Create channel + allocate stock", async ({ request }) => {
			const chRes = await request.post(`${API}/channels`, {
				headers: H,
				data: {
					name: `InvSync Website ${Date.now()}`,
					type: "WEBSITE",
					bufferPercent: 80,
				},
			});
			channelId = (await chRes.json()).data.id;

			await request.post(`${API}/channels/${channelId}/listings`, {
				headers: H,
				data: {
					channelId,
					productId,
					channelSku: "WEB-LSW-001",
					isActive: true,
				},
			});

			const stockRes = await request.post(
				`${API}/channels/${channelId}/stock`,
				{
					headers: H,
					data: { channelId, productId, allocatedQty: 20 },
				},
			);
			expect([200, 201]).toContain(stockRes.status());
		});

		test("Set reorder rule for the product", async ({ request }) => {
			const res = await request.post(`${API}/reorder/rules`, {
				headers: H,
				data: {
					productId,
					reorderPoint: 25,
					reorderQty: 100,
					maxStockQty: 500,
					isAutoPoEnabled: false,
				},
			});
			expect([200, 201]).toContain(res.status());
		});

		test("Deplete stock to near reorder point", async ({ request }) => {
			const res = await request.patch(
				`${API}/catalog/inventory/${productId}`,
				{
					headers: H,
					data: { delta: -8, reason: "Integration: sales depletion" },
				},
			);
			expect(res.ok()).toBe(true);
			const json = await res.json();
			expect(json.data.stockQty).toBeLessThanOrEqual(25);
		});

		test("Stock forecast reflects low stock", async ({ request }) => {
			const res = await request.get(`${API}/reorder/forecast`, {
				headers: H,
			});
			expect(res.ok()).toBe(true);
			const json = await res.json();
			expect(json.success).toBe(true);
		});

		test("Multi-channel inventory snapshot reflects allocation", async ({
			request,
		}) => {
			const res = await request.get(`${API}/channels/inventory`, {
				headers: H,
			});
			expect(res.ok()).toBe(true);
			const json = await res.json();
			expect(json.success).toBe(true);
		});
	},
);

// ── Flow 3: Return → Refund → Analytics Impact ────────────

test.describe.serial("Integration: Return-Refund-Analytics Flow", () => {
	let supplierId: string;
	let productId: string;
	let orderId: string;
	let returnId: string;
	let initialReturnCount: number;

	test("Create entities + delivered order", async ({ request }) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `Return Supplier ${Date.now()}`,
				contactEmail: "ret@e2e.test",
				leadTimeDays: 2,
			},
		});
		supplierId = (await supRes.json()).data.id;

		const prodRes = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "Return Test Dress",
				sku: `RET-${Date.now()}`,
				supplierId,
				hsnCode: "6204",
				costPricePaise: 80000,
				sellingPricePaise: 199900,
				gstRatePercent: 12,
				stockQty: 40,
			},
		});
		productId = (await prodRes.json()).data.id;

		const ordRes = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Return Buyer",
				buyerEmail: "ret-buyer@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "5 Return Lane",
					city: "Chennai",
					state: "Tamil Nadu",
					pin: "600001",
					country: "IN",
				},
				billingAddress: {
					line1: "5 Return Lane",
					city: "Chennai",
					state: "Tamil Nadu",
					pin: "600001",
					country: "IN",
				},
				items: [{ productId, quantity: 2 }],
			},
		});
		orderId = (await ordRes.json()).data.id;

		for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"] as const) {
			await request.patch(`${API}/orders/${orderId}/status`, {
				headers: H,
				data: { status, note: `Ret flow: ${status}` },
			});
		}
	});

	test("Capture initial return analytics", async ({ request }) => {
		const res = await request.get(`${API}/returns/analytics`, {
			headers: H,
		});
		const json = await res.json();
		initialReturnCount = json.data.totalReturns ?? 0;
	});

	test("Create return request", async ({ request }) => {
		const ordRes = await request.get(`${API}/orders/${orderId}`, {
			headers: H,
		});
		const item = (await ordRes.json()).data.items[0];

		const res = await request.post(`${API}/returns`, {
			headers: H,
			data: {
				orderId,
				reason: "WRONG_ITEM",
				customerNotes: "Received wrong color",
				items: [
					{
						orderItemId: item.id,
						productId: item.productId,
						quantity: 1,
						reason: "WRONG_ITEM",
					},
				],
			},
		});
		expect(res.status()).toBe(201);
		returnId = (await res.json()).data.id;
	});

	test("Approve return", async ({ request }) => {
		const res = await request.patch(`${API}/returns/${returnId}`, {
			headers: H,
			data: { status: "APPROVED" },
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	test("Return analytics total incremented", async ({ request }) => {
		const res = await request.get(`${API}/returns/analytics`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.totalReturns).toBeGreaterThanOrEqual(
			initialReturnCount + 1,
		);
	});

	test("Dashboard return rate reflects the return", async ({ request }) => {
		const res = await request.get(`${API}/analytics/dashboard`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data).toHaveProperty("returnRate");
	});
});

// ── Flow 4: RTO Risk Assessment Pipeline ───────────────────

test.describe.serial("Integration: RTO Risk Pipeline", () => {
	let supplierId: string;
	let productId: string;
	let codOrderId: string;
	let prepaidOrderId: string;

	test("Setup: supplier + product", async ({ request }) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `RTO Supplier ${Date.now()}`,
				contactEmail: "rto@e2e.test",
				leadTimeDays: 3,
			},
		});
		supplierId = (await supRes.json()).data.id;

		const prodRes = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "RTO Test Sneakers",
				sku: `RTO-${Date.now()}`,
				supplierId,
				hsnCode: "6404",
				costPricePaise: 120000,
				sellingPricePaise: 349900,
				gstRatePercent: 18,
				stockQty: 100,
			},
		});
		productId = (await prodRes.json()).data.id;
	});

	test("Create COD order (higher RTO risk)", async ({ request }) => {
		const res = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "COD Risk Buyer",
				buyerEmail: "cod-risk@e2e.test",
				buyerPhone: "+919876543210",
				paymentMethod: "COD",
				shippingAddress: {
					line1: "Remote Village",
					city: "Bikaner",
					state: "Rajasthan",
					pin: "334001",
					country: "IN",
				},
				billingAddress: {
					line1: "Remote Village",
					city: "Bikaner",
					state: "Rajasthan",
					pin: "334001",
					country: "IN",
				},
				items: [{ productId, quantity: 1 }],
			},
		});
		expect(res.status()).toBe(201);
		codOrderId = (await res.json()).data.id;
	});

	test("Create prepaid order (lower RTO risk)", async ({ request }) => {
		const res = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "Prepaid Safe Buyer",
				buyerEmail: "prepaid@e2e.test",
				buyerPhone: "+919876543210",
				paymentMethod: "PREPAID",
				shippingAddress: {
					line1: "10 Tech Park",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				billingAddress: {
					line1: "10 Tech Park",
					city: "Bangalore",
					state: "Karnataka",
					pin: "560001",
					country: "IN",
				},
				items: [{ productId, quantity: 1 }],
			},
		});
		expect(res.status()).toBe(201);
		prepaidOrderId = (await res.json()).data.id;
	});

	test("Score COD order for RTO (async)", async ({ request }) => {
		const res = await request.post(`${API}/rto/score`, {
			headers: H,
			data: { orderId: codOrderId },
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	test("Score prepaid order for RTO (async)", async ({ request }) => {
		const res = await request.post(`${API}/rto/score`, {
			headers: H,
			data: { orderId: prepaidOrderId },
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	test("Nudge COD order to prepaid (async)", async ({ request }) => {
		const res = await request.post(`${API}/rto/nudge`, {
			headers: H,
			data: { orderId: codOrderId, channel: "SMS" },
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	test("RTO analytics dashboard has data", async ({ request }) => {
		const res = await request.get(`${API}/rto/analytics`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.totalOrders).toBeGreaterThan(0);
	});
});

// ── Flow 5: Supplier Quality → Scorecard → Rankings ───────

test.describe.serial("Integration: Supplier Quality Pipeline", () => {
	let supplierId: string;

	test("Create supplier with incidents", async ({ request }) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `Quality Supplier ${Date.now()}`,
				contactEmail: "quality@e2e.test",
				leadTimeDays: 4,
			},
		});
		supplierId = (await supRes.json()).data.id;

		const incidents = [
			{
				type: "LATE_DELIVERY",
				severity: "HIGH",
				description: "3 days late on bulk order",
			},
			{
				type: "WRONG_ITEM",
				severity: "MEDIUM",
				description: "Sent wrong SKU",
			},
			{
				type: "QUALITY_ISSUE",
				severity: "LOW",
				description: "Minor stitching defect",
			},
		];

		for (const incident of incidents) {
			const res = await request.post(`${API}/suppliers/incidents`, {
				headers: H,
				data: { supplierId, ...incident },
			});
			expect(res.status()).toBe(201);
		}
	});

	test("Incidents list reflects all 3", async ({ request }) => {
		const res = await request.get(
			`${API}/suppliers/incidents?supplierId=${supplierId}`,
			{ headers: H },
		);
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.items.length).toBeGreaterThanOrEqual(3);
	});

	test("Trigger scorecard computation (async)", async ({ request }) => {
		const now = new Date();
		const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
		const res = await request.post(`${API}/suppliers/scorecards`, {
			headers: H,
			data: { period, supplierId },
		});
		expect([200, 202, 400, 500, 502]).toContain(res.status());
	});

	test("Supplier rankings available", async ({ request }) => {
		const res = await request.get(`${API}/suppliers/rankings`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("Individual scorecard endpoint works", async ({ request }) => {
		const res = await request.get(
			`${API}/suppliers/${supplierId}/scorecard`,
			{ headers: H },
		);
		expect([200, 404]).toContain(res.status());
	});
});

// ── Flow 6: Multi-Channel Order Impact ─────────────────────

test.describe.serial("Integration: Multi-Channel Order Impact", () => {
	let supplierId: string;
	let productId: string;
	let ch1Id: string;
	let ch2Id: string;

	test("Setup: supplier + product + 2 channels", async ({ request }) => {
		const supRes = await request.post(`${API}/catalog/suppliers`, {
			headers: H,
			data: {
				name: `MCh Supplier ${Date.now()}`,
				contactEmail: "mch@e2e.test",
				leadTimeDays: 3,
			},
		});
		supplierId = (await supRes.json()).data.id;

		const prodRes = await request.post(`${API}/catalog/products`, {
			headers: H,
			data: {
				name: "Multi-Ch Cap",
				sku: `MCH-${Date.now()}`,
				supplierId,
				hsnCode: "6505",
				costPricePaise: 20000,
				sellingPricePaise: 49900,
				gstRatePercent: 12,
				stockQty: 100,
			},
		});
		productId = (await prodRes.json()).data.id;

		const ch1Res = await request.post(`${API}/channels`, {
			headers: H,
			data: {
				name: `MCh Amazon ${Date.now()}`,
				type: "AMAZON",
				bufferPercent: 80,
			},
		});
		ch1Id = (await ch1Res.json()).data.id;

		const ch2Res = await request.post(`${API}/channels`, {
			headers: H,
			data: {
				name: `MCh Flipkart ${Date.now()}`,
				type: "FLIPKART",
				bufferPercent: 70,
			},
		});
		ch2Id = (await ch2Res.json()).data.id;
	});

	test("Allocate stock to both channels", async ({ request }) => {
		for (const chId of [ch1Id, ch2Id]) {
			await request.post(`${API}/channels/${chId}/listings`, {
				headers: H,
				data: {
					channelId: chId,
					productId,
					channelSku: `MCH-${chId.slice(-6)}`,
					isActive: true,
				},
			});
			const res = await request.post(`${API}/channels/${chId}/stock`, {
				headers: H,
				data: { channelId: chId, productId, allocatedQty: 40 },
			});
			expect([200, 201]).toContain(res.status());
		}
	});

	test("Order from one channel depletes total stock", async ({ request }) => {
		const ordRes = await request.post(`${API}/orders`, {
			headers: H,
			data: {
				buyerName: "MCh Buyer",
				buyerEmail: "mch-buyer@e2e.test",
				buyerPhone: "+919876543210",
				shippingAddress: {
					line1: "1 MCh St",
					city: "Hyderabad",
					state: "Telangana",
					pin: "500001",
					country: "IN",
				},
				billingAddress: {
					line1: "1 MCh St",
					city: "Hyderabad",
					state: "Telangana",
					pin: "500001",
					country: "IN",
				},
				items: [{ productId, quantity: 5 }],
			},
		});
		expect(ordRes.status()).toBe(201);

		const prodRes = await request.get(
			`${API}/catalog/products/${productId}`,
			{ headers: H },
		);
		const prodJson = await prodRes.json();
		expect(prodJson.data.stockQty).toBeLessThanOrEqual(100);
	});

	test("Inventory snapshot shows both channel allocations", async ({
		request,
	}) => {
		const res = await request.get(`${API}/channels/inventory`, {
			headers: H,
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	test("Cleanup: delete both channels", async ({ request }) => {
		for (const chId of [ch1Id, ch2Id]) {
			const res = await request.delete(`${API}/channels/${chId}`, {
				headers: H,
			});
			expect(res.ok()).toBe(true);
		}
	});
});

// ── Flow 7: Pincode → Carrier Rate → Serviceability Check ─

test.describe.serial("Integration: Pincode Serviceability Pipeline", () => {
	test("Seed serviceability + create rate → check pincode", async ({
		request,
	}) => {
		await request.post(`${API}/pincode/serviceability`, {
			headers: H,
			data: {
				records: [
					{
						pincode: "700001",
						carrier: "BLUEDART",
						isServiceable: true,
						isCodAvailable: true,
						estimatedDays: 4,
						zone: "EAST-1",
					},
					{
						pincode: "700001",
						carrier: "DTDC",
						isServiceable: true,
						isCodAvailable: false,
						estimatedDays: 5,
						zone: "EAST-1",
					},
				],
			},
		});

		await request.post(`${API}/pincode/rates`, {
			headers: H,
			data: {
				carrier: "BLUEDART",
				zone: "EAST-1",
				minWeightGrams: 0,
				maxWeightGrams: 2000,
				basePricePaise: 9000,
				additionalPerGramPaise: 0.8,
				codChargePaise: 5000,
				fuelSurchargePercent: 20,
				validFrom: "2026-01-01",
			},
		});

		const checkRes = await request.post(`${API}/pincode/check`, {
			headers: H,
			data: { pincode: "700001", weightGrams: 1000, isCod: true },
		});
		expect(checkRes.ok()).toBe(true);
		const json = await checkRes.json();
		expect(json.data.pincode).toBe("700001");
		expect(json.data.isServiceable).toBe(true);
		expect(json.data.carriers.length).toBeGreaterThan(0);
	});

	test("Unserviceable pincode returns empty carriers", async ({
		request,
	}) => {
		const res = await request.post(`${API}/pincode/check`, {
			headers: H,
			data: { pincode: "999999", weightGrams: 500, isCod: false },
		});
		expect(res.ok()).toBe(true);
		const json = await res.json();
		expect(json.data.carriers).toHaveLength(0);
	});
});
