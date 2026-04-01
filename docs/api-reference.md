# DropFlow API reference

Base path: `/api/v1/`. All JSON responses from authenticated REST handlers use the envelope below unless noted.

## Conventions

### Authentication

| Environment | Mechanism |
|-------------|-----------|
| Production | Clerk session (signed-in user with an active organization). |
| Development | When `NEXT_PUBLIC_APP_ENV=development` and `E2E_TEST_KEY` is set, send header `x-e2e-test-key: <E2E_TEST_KEY>` to impersonate the E2E tenant (`org_test_dropflow`). |

If authentication or tenant resolution fails, handlers typically return `500` with `success: false` and an error whose `message` describes the failure (for example `Unauthorized`).

### Response envelope (JSON)

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the call succeeded. |
| `data` | `T` | Present when `success` is `true`. |
| `error` | `{ code: string, message: string }` | Present when `success` is `false`. |

### Pagination

List endpoints return:

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}
```

Query parameters: `page` (default `1`), `pageSize` (default `20`, max `100` where validated). (`pageSize` is the page length; some clients refer to this as `limit`, but the API expects `pageSize`.)

---

## Catalog – products

| Method | Path | Auth | Query / body | Success response | HTTP | Error codes (status) |
|--------|------|------|--------------|------------------|------|----------------------|
| GET | `/api/v1/catalog/products` | Yes | Query: `page`, `pageSize`, `search`, `supplierId`, `isActive`, `isListed`, `lowStock` | `{ success, data: { items: Product[], total, page, pageSize, hasMore } }` | 200 | `PRODUCTS_FETCH_FAILED` (500) |
| POST | `/api/v1/catalog/products` | Yes | Body: see below | `{ success, data: Product }` | 201 | `DUPLICATE_SKU` (409, Prisma `P2002` unique violation on SKU); `PRODUCT_CREATE_FAILED` (400) |
| GET | `/api/v1/catalog/products/[id]` | Yes | — | `{ success, data: Product }` (includes `supplier`, `variants`) | 200 | `NOT_FOUND` (404); `PRODUCT_FETCH_FAILED` (500) |
| PATCH | `/api/v1/catalog/products/[id]` | Yes | Body: partial product fields (see below; `supplierId` and `sku` omitted from updates) | `{ success, data: Product }` | 200 | `NOT_FOUND` (404); `PRODUCT_UPDATE_FAILED` (400) |

### `POST /api/v1/catalog/products` body

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `name` | string | Yes | |
| `sku` | string | Yes | Unique per tenant. |
| `supplierId` | string | Yes | |
| `hsnCode` | string | Yes | Min 4 characters. |
| `costPricePaise` | integer | Yes | Non-negative; paise. |
| `sellingPricePaise` | integer | Yes | Non-negative; paise. |
| `gstRatePercent` | integer | Yes | One of `0`, `3`, `5`, `12`, `18`, `28`. |
| `stockQty` | integer | No | Default `0`. |
| `lowStockThreshold` | integer | No | Default `10`. |
| `description` | string | No | |
| `images` | string[] (URLs) | No | Default `[]`. |

Server computes `marginPercent` from cost and selling price.

### `PATCH /api/v1/catalog/products/[id]` body

Same fields as create, all optional except as enforced by Zod partial schema; `supplierId` and `sku` cannot be changed via this route.

---

## Catalog – suppliers

| Method | Path | Auth | Query / body | Success response | HTTP | Error codes (status) |
|--------|------|------|--------------|------------------|------|----------------------|
| GET | `/api/v1/catalog/suppliers` | Yes | — | `{ success, data: Supplier[] }` (each with `_count.products`) | 200 | `SUPPLIERS_FETCH_FAILED` (500) |
| POST | `/api/v1/catalog/suppliers` | Yes | Body: see below | `{ success, data: Supplier }` | 201 | `SUPPLIER_CREATE_FAILED` (400) |

### `POST /api/v1/catalog/suppliers` body

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `name` | string | Yes | |
| `contactEmail` | string (email) | No | |
| `contactPhone` | string | No | |
| `gstin` | string | No | Valid GSTIN format when present. |
| `leadTimeDays` | integer | No | Default `3`, positive. |
| `returnWindowDays` | integer | No | Default `7`, non-negative. |

---

## Catalog – inventory

| Method | Path | Auth | Body | Success response | HTTP | Error codes (status) |
|--------|------|------|------|------------------|------|----------------------|
| PATCH | `/api/v1/catalog/inventory/[id]` | Yes | See below | `{ success, data: { id, sku, stockQty, previousStockQty, reason } }` | 200 | `NOT_FOUND` (404); `INVALID_INPUT` (400, neither `stockQty` nor `delta`); `INSUFFICIENT_STOCK` (400, stock would go negative); `INVENTORY_UPDATE_FAILED` (400) |

`[id]` is the **product** id.

### Body

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `reason` | string | Yes | Non-empty. |
| `delta` | integer | One of `delta` or `stockQty` | Applied to current `stockQty`. |
| `stockQty` | integer | One of `delta` or `stockQty` | Sets absolute stock (non-negative). |

---

## Orders

| Method | Path | Auth | Query / body | Success response | HTTP | Error codes (status) |
|--------|------|------|--------------|------------------|------|----------------------|
| GET | `/api/v1/orders` | Yes | Query: `page`, `pageSize`, `status`, `search`, `supplierId`, `dateFrom`, `dateTo` | `{ success, data: { items: Order[], total, page, pageSize, hasMore } }` | 200 | `ORDERS_FETCH_FAILED` (500) |
| POST | `/api/v1/orders` | Yes | Body: see below | `{ success, data: Order }` with `items` (and product summaries) | 201 | `ORDER_CREATE_FAILED` (400; e.g. unknown product id, insufficient stock) |
| GET | `/api/v1/orders/[id]` | Yes | — | `{ success, data: Order }` including `items`, `statusHistory`, `payments`, `shipment`, `invoice`, `purchaseOrder`, optional `workflowRun` | 200 | `NOT_FOUND` (404); `ORDER_FETCH_FAILED` (500) |
| PATCH | `/api/v1/orders/[id]/status` | Yes | Body: `{ status, note? }` | `{ success, data: Order }` (updated row) | 200 | `NOT_FOUND` (404); `STATUS_UPDATE_FAILED` (400) |
| POST | `/api/v1/orders/[id]/pay` | Yes | — | `{ success, data: { razorpayOrderId, amountPaise, currency, keyId } }` | 200 | `NOT_FOUND` (404); `INVALID_STATE` (400, not `PENDING`); `PAYMENT_INIT_FAILED` (500) |

### Pricing (`POST /api/v1/orders`)

Subtotal is the sum of `quantity * sellingPricePaise` per line. Tax per line is `round((line total * gstRatePercent) / 100)`. Order `totalPaise` = subtotal + tax. Stock must cover `quantity` after reserved quantity.

### `POST /api/v1/orders` body

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `buyerName` | string | Yes | |
| `buyerEmail` | string (email) | Yes | |
| `buyerPhone` | string | Yes | Format `+91` + 10 digits. |
| `shippingAddress` | object | Yes | `line1`, `city`, `state`, `pin` (6 digits), `country` (default `IN`), optional `line2`. |
| `billingAddress` | object | Yes | Same shape as shipping. |
| `items` | array | Yes | `{ productId, quantity, variantId? }` |
| `currency` | enum | No | `INR` (default), `USD`, `EUR`, `GBP`. |
| `notes` | string | No | |

### `PATCH /api/v1/orders/[id]/status` – `status` values

`PENDING`, `PAYMENT_PENDING`, `PAYMENT_CONFIRMED`, `ROUTING`, `PO_CREATED`, `SUPPLIER_CONFIRMED`, `PROCESSING`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `RETURN_REQUESTED`, `RETURNED`, `REFUNDED`.

---

## Invoices

| Method | Path | Auth | Query / body | Success response | HTTP | Error codes (status) |
|--------|------|------|--------------|------------------|------|----------------------|
| GET | `/api/v1/invoices` | Yes | Query: `page`, `pageSize`, `orderId`, `dateFrom`, `dateTo`, `gstType` | Paginated invoice list | 200 | `INVOICES_FETCH_FAILED` (500) |
| POST | `/api/v1/invoices` | Yes | Body: `{ orderId: string }` | `{ success, data: Invoice }` | 201 if created | `MISSING_ORDER_ID` (400); `NOT_FOUND` (404); `INVOICE_CREATE_FAILED` (400) |
| GET | `/api/v1/invoices/[id]` | Yes | — | `{ success, data: Invoice }` with nested `order` | 200 | `NOT_FOUND` (404); `INVOICE_FETCH_FAILED` (500) |

### GST type (`POST /api/v1/invoices`)

Uses tenant `sellerStateCode` (default `29`) and buyer state from `order.shippingAddress.state` (resolved via GST state codes). Line-level GST via `@dropflow/gst` produces **CGST+SGST** (intra-state) or **IGST** (inter-state). Invoice `gstType` is `IGST`, `CGST_SGST`, or `EXEMPT` as aggregated.

If an invoice already exists for `orderId`, the handler returns **200** with the existing invoice (idempotent; not a second `201`).

---

## Shipments

| Method | Path | Auth | Query | Success response | HTTP | Error codes (status) |
|--------|------|------|-------|------------------|------|----------------------|
| GET | `/api/v1/shipments` | Yes | `page`, `pageSize` | Paginated list with `order` summary | 200 | `SHIPMENTS_FETCH_FAILED` (500) |

---

## Analytics – margins

| Method | Path | Auth | Query / body | Success response | HTTP | Error codes (status) |
|--------|------|------|--------------|------------------|------|----------------------|
| GET | `/api/v1/analytics/margins` | Yes | Query: `dateFrom`, `dateTo` (ISO date strings), `productId`, `supplierId`, `sortBy` (`margin` \| `revenue` \| `orders`), `sortOrder`, `page`, `pageSize` (see `MarginFilters` in `@dropflow/types`) | `{ success, data: MarginDashboardKPIs & { aggregateWaterfall } }`. `aggregateWaterfall` sums each cost/revenue component across `OrderMarginBreakdown` rows for orders whose `createdAt` falls in the range (default lookback from `ANALYTICS.DEFAULT_LOOKBACK_DAYS` when `dateFrom` omitted). | 200 | `VALIDATION_ERROR` (400); `UNAUTHORIZED` (401); `FETCH_FAILED` (500) |
| GET | `/api/v1/analytics/margins/[orderId]` | Yes | — | `{ success, data: OrderMarginResponse }` including `waterfall` steps (`MarginWaterfallItem[]`) | 200 | `NOT_FOUND` (404); `UNAUTHORIZED` (401); `FETCH_FAILED` (500) |

Margin rows are produced by the worker job `compute-order-margins` on `analytics-queue` (payload `{ tenantId, orderId }`). Top and worst products are derived by allocating each order’s `netMarginPaise` to line items by share of `subtotalPaise`.

---

## SSE

| Method | Path | Auth | Success response | Error |
|--------|------|------|------------------|-------|
| GET | `/api/v1/sse` | Yes (tenant resolved like other routes) | `text/event-stream` body proxied from the worker (`/sse/:tenantId`) | Plain text `502` / `500` if the worker connection fails (not the standard JSON envelope). |

---

## Webhooks

| Method | Path | Auth | Body | Success response | Error |
|--------|------|------|------|------------------|-------|
| POST | `/api/v1/webhooks/razorpay` | HMAC | Raw JSON body; header `x-razorpay-signature` | `{ received: true }` | `{ error: string }` with `400` / `401` / `500` as applicable. |

Uses `RAZORPAY_WEBHOOK_SECRET`. Handles `payment.captured` (creates payment, sets order `PAYMENT_CONFIRMED`, enqueues order job) and `refund.processed`. **Does not** use the `{ success, data, error }` envelope.

---

## Changelog

- **2026-04-01:** Analytics margin dashboard (`GET /api/v1/analytics/margins`, `GET /api/v1/analytics/margins/[orderId]`).
- **2026-03-30:** Initial API reference.
