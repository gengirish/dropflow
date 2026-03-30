---
name: vitest-playwright-msw
description: >-
  Testing strategy for DropFlow — Vitest for unit/integration tests, Playwright
  for E2E, MSW for API mocking. Use when writing tests for any part of the
  codebase.
---

# Testing — Vitest + Playwright + MSW

Packages: `vitest`, `@playwright/test`, `msw`

## Test Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| `packages/gst` | Vitest | 100% (financial logic) |
| `packages/types` | Vitest | All Zod parse/reject cases |
| `apps/web/api` | Vitest + MSW | All API routes |
| `apps/worker/dag` | Vitest | Each step + full workflow |
| E2E flows | Playwright | Order → invoice → shipment |

## Vitest Config (packages/gst/vitest.config.ts)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      thresholds: { lines: 100, functions: 100, branches: 100 },
    },
  },
});
```

## Unit Test Example (packages/gst)

```typescript
import { describe, it, expect } from "vitest";
import { calculateGST } from "../src/calculate";

describe("calculateGST", () => {
  it("calculates CGST+SGST for intra-state", () => {
    const result = calculateGST({
      subtotalPaise: 100000, // ₹1,000
      hsnCode: "6109",
      sellerStateCode: "29",
      buyerStateCode: "29",
      isExport: false,
    });

    expect(result.gstType).toBe("CGST_SGST");
    expect(result.cgstPaise).toBe(2500);  // 2.5%
    expect(result.sgstPaise).toBe(2500);  // 2.5%
    expect(result.igstPaise).toBe(0);
    expect(result.totalTaxPaise).toBe(5000);
    expect(result.totalWithTaxPaise).toBe(105000);
  });

  it("calculates IGST for inter-state", () => {
    const result = calculateGST({
      subtotalPaise: 100000,
      hsnCode: "6109",
      sellerStateCode: "29", // Karnataka
      buyerStateCode: "27", // Maharashtra
      isExport: false,
    });

    expect(result.gstType).toBe("IGST");
    expect(result.igstPaise).toBe(5000);
    expect(result.cgstPaise).toBe(0);
  });

  it("returns zero tax for export with LUT", () => {
    const result = calculateGST({
      subtotalPaise: 100000,
      hsnCode: "6109",
      sellerStateCode: "29",
      buyerStateCode: null,
      isExport: true,
    });

    expect(result.gstType).toBe("EXPORT_LUT");
    expect(result.totalTaxPaise).toBe(0);
  });

  it("uses only integer arithmetic — no floating-point drift", () => {
    const result = calculateGST({
      subtotalPaise: 33333, // odd amount
      hsnCode: "6109",
      sellerStateCode: "29",
      buyerStateCode: "29",
      isExport: false,
    });

    expect(Number.isInteger(result.cgstPaise)).toBe(true);
    expect(Number.isInteger(result.sgstPaise)).toBe(true);
    expect(result.cgstPaise + result.sgstPaise).toBe(result.totalTaxPaise);
  });
});
```

## MSW for API Mocking

```typescript
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.post("https://api.razorpay.com/v1/orders", () => {
    return HttpResponse.json({
      id: "order_test123",
      amount: 100000,
      currency: "INR",
    });
  }),

  http.post("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", () => {
    return HttpResponse.json({ order_id: 12345, shipment_id: 67890 });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Playwright E2E (e2e/order-flow.spec.ts)

```typescript
import { test, expect } from "@playwright/test";

test("full order flow: create → pay → ship → deliver", async ({ page }) => {
  // Login
  await page.goto("/sign-in");
  await page.fill("[name=email]", "test@dropflow.in");
  // ... auth flow

  // Create order
  await page.goto("/orders/new");
  await page.fill("[name=buyerName]", "Test Customer");
  await page.click("text=Create Order");
  await expect(page.locator(".order-number")).toBeVisible();

  // Verify order appears in list
  await page.goto("/orders");
  await expect(page.locator("text=Test Customer")).toBeVisible();
});
```

## Running Tests

```bash
# Unit + integration
pnpm --filter gst test            # GST engine
pnpm --filter types test           # Zod schemas
pnpm --filter web test             # API routes
pnpm --filter worker test          # Worker/DAG

# E2E
pnpm --filter web playwright test

# All tests across monorepo
pnpm turbo test

# Coverage
pnpm --filter gst test -- --coverage
```

## Conventions

- GST package: 100% test coverage mandatory — financial logic must be bulletproof
- Use MSW to mock all external APIs (Razorpay, Stripe, Shiprocket, EasyPost)
- Mock Prisma with `vitest.mock()` for API route tests
- Playwright tests run against a real dev server with seeded test data
- Never test implementation details — test behavior and outputs
