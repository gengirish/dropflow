import { test, expect } from "@playwright/test";

/**
 * Auth & Security E2E: Verifies Clerk middleware enforcement.
 * - Unauthenticated requests to protected routes must be rejected
 * - Public routes must remain accessible
 * - E2E bypass header must only work with the correct key
 */

const API = process.env.PROD_URL
	? `${process.env.PROD_URL}/api/v1`
	: "https://dropflow-beta.vercel.app/api/v1";

const BASE = process.env.PROD_URL ?? "https://dropflow-beta.vercel.app";

const VALID_HEADERS = {
	"x-e2e-test-key": "dropflow-e2e-test-secret-key-2024",
};

test.describe("Auth — Unauthenticated API requests are rejected", () => {
	const protectedEndpoints = [
		{ method: "GET", path: "/orders" },
		{ method: "GET", path: "/catalog/products" },
		{ method: "GET", path: "/catalog/suppliers" },
		{ method: "GET", path: "/invoices" },
		{ method: "GET", path: "/shipments" },
		{ method: "GET", path: "/channels" },
		{ method: "GET", path: "/analytics/dashboard" },
		{ method: "GET", path: "/analytics/margins" },
		{ method: "GET", path: "/analytics/revenue" },
		{ method: "GET", path: "/rto/analytics" },
		{ method: "GET", path: "/returns" },
		{ method: "GET", path: "/returns/analytics" },
		{ method: "GET", path: "/reconciliation/records" },
		{ method: "GET", path: "/reorder/rules" },
		{ method: "GET", path: "/reorder/alerts" },
		{ method: "GET", path: "/notifications/templates" },
		{ method: "GET", path: "/notifications/logs" },
		{ method: "GET", path: "/suppliers/scorecards" },
		{ method: "GET", path: "/suppliers/rankings" },
		{ method: "GET", path: "/workflows" },
		{ method: "GET", path: "/pincode/rates" },
	];

	for (const ep of protectedEndpoints) {
		test(`${ep.method} ${ep.path} — no auth → non-200`, async ({
			request,
		}) => {
			const res = await request.get(`${API}${ep.path}`, { headers: {} });
			expect(res.ok()).toBe(false);
		});
	}

	test("POST /orders — no auth → rejected", async ({ request }) => {
		const res = await request.post(`${API}/orders`, {
			headers: {},
			data: { buyerName: "Hacker" },
		});
		expect(res.ok()).toBe(false);
	});

	test("POST /catalog/products — no auth → rejected", async ({ request }) => {
		const res = await request.post(`${API}/catalog/products`, {
			headers: {},
			data: { name: "Hacker Product" },
		});
		expect(res.ok()).toBe(false);
	});
});

test.describe("Auth — E2E bypass only works with correct key", () => {
	test("Wrong e2e key → rejected", async ({ request }) => {
		const res = await request.get(`${API}/orders`, {
			headers: { "x-e2e-test-key": "wrong-key" },
		});
		expect(res.ok()).toBe(false);
	});

	test("Empty e2e key → rejected", async ({ request }) => {
		const res = await request.get(`${API}/orders`, {
			headers: { "x-e2e-test-key": "" },
		});
		expect(res.ok()).toBe(false);
	});

	test("Valid e2e key → 200", async ({ request }) => {
		const res = await request.get(`${API}/orders`, {
			headers: VALID_HEADERS,
		});
		expect(res.ok()).toBe(true);
	});
});

test.describe("Auth — Public routes remain accessible", () => {
	test("GET / (homepage) — accessible without auth", async ({ request }) => {
		const res = await request.get(BASE);
		expect(res.ok()).toBe(true);
	});

	test("GET /sign-in — accessible without auth", async ({ request }) => {
		const res = await request.get(`${BASE}/sign-in`);
		expect(res.ok()).toBe(true);
	});

	test("GET /sign-up — accessible without auth", async ({ request }) => {
		const res = await request.get(`${BASE}/sign-up`);
		expect(res.ok()).toBe(true);
	});
});
