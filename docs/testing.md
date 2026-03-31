# Testing strategy

DropFlow uses three complementary layers: fast unit tests for GST and related business logic, API end-to-end tests against a running app, and the same style of checks against the live Vercel deployment.

## Testing strategy

1. **Unit tests (Vitest)** — Business logic in packages such as `@dropflow/gst` (GST calculations, HSN handling, GSTIN validation).
2. **E2E API tests (Playwright)** — Full order lifecycle against the app, using the HTTP client only (no browser). Default target is `http://localhost:3000`.
3. **Production E2E (Playwright)** — Same API-style flow against `https://dropflow-beta.vercel.app` (override base URL with `PROD_URL` if needed).

Root Playwright config (`playwright.config.ts`): `testDir` is `./e2e`, default timeout 60s, `baseURL` `http://localhost:3000`. Projects include **`api`** (`testMatch`: `.*\.api\.ts`) and **`ui`** (`chromium` for `*.ui.ts`). A **`webServer`** entry runs `pnpm --filter web dev` on port 3000 with `reuseExistingServer: true`, so a manually started dev server is optional.

## Unit tests

- **Framework:** Vitest (`packages/gst/vitest.config.ts`), `globals: true`.
- **Location:** `packages/gst/src/__tests__/` (e.g. `calculate.test.ts`, `validate-gstin.test.ts`, `format.test.ts`).
- **Coverage:** v8 provider; `include` `src/**/*.ts`; `exclude` `src/index.ts`, `src/types.ts`. Thresholds are **100%** for lines, functions, branches, and statements — aimed at critical business logic (GST calculations, GSTIN validation, formatting).
- **Run:** `pnpm test` (Turbo runs workspace tests) or `pnpm --filter @dropflow/gst test`.

`calculate.test.ts` exercises `calculateGST` (CGST/SGST, IGST, export LUT, exempt HSN, rounding, edge cases) and `isValidHSNCode`.

## E2E tests

- **Framework:** Playwright with the **`request`** fixture (API testing, no browser for `*.api.ts`).
- **Location:** `e2e/`.
- **Project:** Pass `--project=api` so only `*.api.ts` files run.

### `e2e/full-order-flow.api.ts` (13 tests, localhost)

Serial suite against `http://localhost:3000/api/v1`. Header `x-e2e-test-key` matches the dev E2E secret.

| # | Test case |
|---|-----------|
| 1 | Create supplier |
| 2 | Create product |
| 3 | List products |
| 4 | Create order (pricing verified: subtotal, tax, total) |
| 5 | Get order detail |
| 6 | List orders |
| 7 | Generate GST invoice (CGST+SGST intra-state verification) |
| 8 | List invoices |
| 9 | Update order status (to SHIPPED) |
| 10 | Update inventory |
| 11 | Filter orders by status |
| 12 | Search orders by name |
| 13 | List shipments |

### `e2e/production.api.ts` (12 tests, Vercel)

Serial suite; API base URL is `process.env.PROD_URL` + `/api/v1` when set, otherwise `https://dropflow-beta.vercel.app/api/v1`. Same `x-e2e-test-key` header pattern as local.

| # | Test case |
|---|-----------|
| 1 | Create supplier |
| 2 | Create product |
| 3 | List products |
| 4 | Create order with pricing verification |
| 5 | Get order detail |
| 6 | Generate GST invoice (intra-state CGST+SGST) |
| 7 | List invoices |
| 8 | Update order status |
| 9 | Update inventory |
| 10 | Search and filter orders |
| 11 | List shipments |
| 12 | List suppliers |

Production does not duplicate every local step (for example, there is no separate “list orders” or “filter by status” test); it adds **list suppliers** and combines search coverage into one step.

### Auth bypass for E2E

Tests send the **`x-e2e-test-key`** header so Clerk can be bypassed in development:

- Middleware allows the bypass only when **`NEXT_PUBLIC_APP_ENV === "development"`** and the header matches **`E2E_TEST_KEY`**.
- Auth helper **`getAuthTenant()`** resolves a fixed test tenant (**`org_test_dropflow`**).
- **Do not** enable or rely on this path in production.

## Running tests

```bash
# Unit tests
pnpm test

# E2E (local — dev server: either let Playwright start it via webServer, or run in another terminal)
pnpm --filter web dev
npx playwright test e2e/full-order-flow.api.ts --project=api

# E2E (production)
npx playwright test e2e/production.api.ts --project=api
```

For production, set `PROD_URL` (including scheme, no trailing slash) if the deployment URL is not the default beta host.

## Test data

- **`pnpm db:seed`** seeds the database (via `@dropflow/db`), including the test tenant **`org_test_dropflow`**, supplier **Ace Textiles**, and two products.
- E2E suites create their own entities with **unique SKUs** using `Date.now()` (and timestamped supplier names on production) so runs do not collide.

## Changelog

- **2026-03-30:** All 13 local E2E (`full-order-flow.api.ts`) and 12 production E2E (`production.api.ts`) passing.
