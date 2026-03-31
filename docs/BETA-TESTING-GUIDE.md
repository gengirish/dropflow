# DropFlow Beta Testing Guide

**Version:** 1.0  
**Date:** 31 March 2026  
**Prepared by:** Engineering Team  

---

## Table of Contents

1. [App Overview](#app-overview)
2. [Environments & URLs](#environments--urls)
3. [Getting Started](#getting-started)
4. [Test Scenarios](#test-scenarios)
   - [A. Catalog Management](#a-catalog-management)
   - [B. Order Lifecycle](#b-order-lifecycle)
   - [C. Finance & Invoicing](#c-finance--invoicing)
   - [D. Shipments](#d-shipments)
   - [E. Workflow Engine](#e-workflow-engine)
5. [API Testing (Postman / cURL)](#api-testing-postman--curl)
6. [Edge Cases & Negative Tests](#edge-cases--negative-tests)
7. [Bug Reporting Template](#bug-reporting-template)
8. [Appendix: Status Flow & Field Reference](#appendix-status-flow--field-reference)

---

## App Overview

DropFlow is an order management and fulfillment platform for Indian D2C brands. It covers:

- **Catalog** — Products, suppliers, inventory management
- **Orders** — Order creation, status tracking, workflow automation
- **Payments** — Razorpay integration (test mode)
- **Invoicing** — GST-compliant invoice generation (CGST/SGST/IGST)
- **Shipments** — Shipment tracking and carrier integration
- **Workflow Engine** — DAG-based order fulfillment pipeline

---

## Environments & URLs

| Service | URL | Notes |
|---------|-----|-------|
| **Web Dashboard** | https://dropflow-beta.vercel.app | Next.js frontend |
| **Worker API** | https://dropflow-worker.fly.dev | BullMQ worker (internal) |
| **Worker Health** | https://dropflow-worker.fly.dev/health | Queue stats |
| **Database** | Neon PostgreSQL | Managed, no direct access |

### Authentication

The app uses **Clerk** for authentication. For beta testing, we bypass Clerk using an **E2E test key** in API headers.

**E2E Test Header:**
```
x-e2e-test-key: dropflow-e2e-test-secret-key-2024
```

> Add this header to ALL API requests. The dashboard UI requires Clerk auth — for UI testing, you'll need a Clerk account (ask the team lead for invite).

---

## Getting Started

### Option 1: UI Testing (Browser)

1. Open https://dropflow-beta.vercel.app
2. Click **Get Started** or **Sign In**
3. Create an account or use provided test credentials
4. You'll land on the dashboard with sidebar navigation:
   - **Orders** — View and create orders
   - **Catalog** — Manage products and suppliers
   - **Shipments** — Track shipments
   - **Finance** — View invoices and KPIs
   - **Settings** — (Coming soon)

### Option 2: API Testing (Postman / cURL)

Base URL:
```
https://dropflow-beta.vercel.app/api/v1
```

All requests need the E2E header:
```
x-e2e-test-key: dropflow-e2e-test-secret-key-2024
```

> A pre-seeded test tenant ("Test Store") with one supplier ("Ace Textiles") and two products already exists in the database.

---

## Test Scenarios

### A. Catalog Management

#### A1. View Products

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to **/catalog** (or `GET /api/v1/catalog/products`) | Product list loads with at least 2 seeded products |
| 2 | Verify columns: Name, SKU, Price, Stock, GST Rate, Status | All columns display correctly |
| 3 | Use the search box to filter by name | Table filters in real-time |

#### A2. Create a Product

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Add Product** button | Dialog/modal opens |
| 2 | Fill in the form: | |
| | **Name:** Test Kurta Set | |
| | **SKU:** KURTA-BLU-L | |
| | **Supplier:** Ace Textiles (dropdown) | |
| | **HSN Code:** 6211 | |
| | **Cost Price:** 450 | |
| | **Selling Price:** 899 | |
| | **GST Rate:** 12% | |
| | **Stock:** 50 | |
| 3 | Click Create | Success toast, product appears in list |
| 4 | Try creating another product with same SKU `KURTA-BLU-L` | Should show error (duplicate SKU) |

#### A3. Create a Supplier

**API only** (no UI form for supplier creation):

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/catalog/suppliers \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "name": "Bharat Fabrics",
    "contactEmail": "contact@bharatfabrics.in",
    "contactPhone": "+919876543210",
    "gstin": "27AABCU9603R1ZM",
    "leadTimeDays": 5,
    "returnWindowDays": 14
  }'
```

**Expected:** 201 Created with supplier object.

#### A4. Update Inventory

```bash
curl -X PATCH https://dropflow-beta.vercel.app/api/v1/catalog/inventory/{PRODUCT_ID} \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "delta": -5,
    "reason": "Damaged in warehouse"
  }'
```

**Expected:** Stock decreases by 5. Verify on product detail.

---

### B. Order Lifecycle

This is the **most critical flow**. Test it end-to-end.

#### B1. Create an Order (UI)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to **/orders** and click **New Order** | Redirects to `/orders/new` |
| 2 | Select products from the list and set quantities | Items appear in the cart sidebar |
| 3 | Fill in customer details: | |
| | **Name:** Rahul Sharma | |
| | **Email:** rahul@test.com | |
| | **Phone:** +919876543210 | |
| | **Address Line 1:** 42 MG Road | |
| | **City:** Bengaluru | |
| | **State:** Karnataka | |
| | **PIN:** 560001 | |
| 4 | Click **Place Order** | Success message, redirects to order detail |
| 5 | Check the order detail page | Status: PENDING, line items match, totals correct |

#### B2. Create an Order (API)

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "buyerName": "Priya Patel",
    "buyerEmail": "priya@test.com",
    "buyerPhone": "+919123456789",
    "shippingAddress": {
      "line1": "101 Lake View Apartments",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pin": "400001"
    },
    "billingAddress": {
      "line1": "101 Lake View Apartments",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pin": "400001"
    },
    "items": [
      { "productId": "<PRODUCT_ID>", "quantity": 2 }
    ]
  }'
```

> Replace `<PRODUCT_ID>` with an actual product ID from `GET /api/v1/catalog/products`.

**Expected:** 201 Created with order object containing `orderNumber`, `status: "PENDING"`, computed `subtotalPaise`, `taxPaise`, `totalPaise`.

#### B3. Track Order Status Changes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open the order detail page (`/orders/{id}`) | Status shows PENDING |
| 2 | Wait ~10 seconds (workflow auto-processes) | Status updates through the pipeline |
| 3 | Verify workflow steps panel | Shows DAG steps with timestamps |
| 4 | Check status history section | All transitions logged with timestamps |

#### B4. Manually Update Order Status (API)

```bash
curl -X PATCH https://dropflow-beta.vercel.app/api/v1/orders/{ORDER_ID}/status \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "status": "PROCESSING",
    "note": "Picked from warehouse"
  }'
```

**Valid status transitions:**
```
PENDING → PAYMENT_PENDING → PAYMENT_CONFIRMED → PROCESSING → SHIPPED → DELIVERED
                                                                    ↘ CANCELLED
                                                         REFUND_REQUESTED → REFUNDED
```

#### B5. Filter Orders

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On **/orders**, use the status dropdown | Table filters by selected status |
| 2 | Type in the search box | Filters by order number, buyer name, or email |
| 3 | `GET /api/v1/orders?status=PENDING&page=1&pageSize=5` | Returns only PENDING orders, paginated |

---

### C. Finance & Invoicing

#### C1. View Finance Dashboard

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to **/finance** | KPI cards and invoices table load |
| 2 | Verify invoice data matches created orders | Invoice amounts align with order totals |

#### C2. Create an Invoice (API)

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/invoices \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "orderId": "<ORDER_ID>"
  }'
```

**Expected:** Invoice with GST breakdown:
- **Intra-state** (seller & buyer in same state): CGST + SGST (each = half of GST)
- **Inter-state** (different states): IGST (full GST amount)
- Invoice number format: `INV/YYMM/XXXX`
- Calling again with same `orderId` returns existing invoice (idempotent)

#### C3. Get Invoice Details

```bash
curl https://dropflow-beta.vercel.app/api/v1/invoices/{INVOICE_ID} \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

**Verify:** `subtotalPaise`, `cgstPaise`, `sgstPaise`, `igstPaise`, `totalTaxPaise`, `totalPaise`, `gstType` (INTRA_STATE or INTER_STATE).

---

### D. Shipments

#### D1. View Shipments

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to **/shipments** | Shipments table loads |
| 2 | Verify columns: Order #, Carrier, AWB, Status, Est. Delivery | Data displays correctly |
| 3 | `GET /api/v1/shipments?page=1&pageSize=10` | Returns paginated shipment list |

---

### E. Workflow Engine

The workflow engine automatically processes orders through a DAG (Directed Acyclic Graph) pipeline.

#### E1. Verify Workflow Execution

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create a new order | Order status starts at PENDING |
| 2 | Open order detail page | Workflow panel appears showing DAG steps |
| 3 | Watch the workflow progress (page auto-polls every 3s) | Steps complete with green checkmarks |
| 4 | Expected DAG steps: | |
| | → Validate Order | |
| | → Reserve Inventory | |
| | → Create Purchase Order | |
| | → Generate Invoice | |
| | → Create Shipment | |
| 5 | After all steps complete | Order status reflects workflow completion |

---

## API Testing (Postman / cURL)

### Quick Reference — All Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/catalog/products` | List products |
| `POST` | `/api/v1/catalog/products` | Create product |
| `GET` | `/api/v1/catalog/products/:id` | Get product detail |
| `PATCH` | `/api/v1/catalog/products/:id` | Update product |
| `GET` | `/api/v1/catalog/suppliers` | List suppliers |
| `POST` | `/api/v1/catalog/suppliers` | Create supplier |
| `PATCH` | `/api/v1/catalog/inventory/:id` | Update stock |
| `GET` | `/api/v1/orders` | List orders |
| `POST` | `/api/v1/orders` | Create order |
| `GET` | `/api/v1/orders/:id` | Get order detail |
| `PATCH` | `/api/v1/orders/:id/status` | Update order status |
| `POST` | `/api/v1/orders/:id/pay` | Initiate Razorpay payment |
| `GET` | `/api/v1/invoices` | List invoices |
| `POST` | `/api/v1/invoices` | Create invoice |
| `GET` | `/api/v1/invoices/:id` | Get invoice detail |
| `GET` | `/api/v1/shipments` | List shipments |

### Postman Collection Setup

1. Create a new collection called **DropFlow Beta**
2. Set collection-level variable:
   - `baseUrl` = `https://dropflow-beta.vercel.app/api/v1`
3. Set collection-level header:
   - `x-e2e-test-key` = `dropflow-e2e-test-secret-key-2024`
4. Create requests in this order (save IDs from responses):
   - Create Supplier → save `supplierId`
   - Create Product → save `productId`
   - Create Order → save `orderId`
   - Get Order Detail
   - Create Invoice → save `invoiceId`
   - Update Order Status
   - List all (products, orders, invoices, shipments)

### Suggested Test Run Sequence

```bash
# 1. List existing products
curl -s https://dropflow-beta.vercel.app/api/v1/catalog/products \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" | jq '.data[0].id'

# 2. Create an order with that product ID
curl -s -X POST https://dropflow-beta.vercel.app/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "buyerName": "Test User",
    "buyerEmail": "test@example.com",
    "buyerPhone": "+919000000001",
    "shippingAddress": {
      "line1": "123 Test Lane",
      "city": "Bengaluru",
      "state": "Karnataka",
      "pin": "560001"
    },
    "billingAddress": {
      "line1": "123 Test Lane",
      "city": "Bengaluru",
      "state": "Karnataka",
      "pin": "560001"
    },
    "items": [{"productId": "<PASTE_PRODUCT_ID>", "quantity": 1}]
  }' | jq '.id, .orderNumber, .status, .totalPaise'

# 3. Check the order detail (wait 10s for workflow)
curl -s https://dropflow-beta.vercel.app/api/v1/orders/<ORDER_ID> \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" | jq '.status, .workflowRun.status'

# 4. Create invoice for the order
curl -s -X POST https://dropflow-beta.vercel.app/api/v1/invoices \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{"orderId": "<ORDER_ID>"}' | jq '.invoiceNumber, .gstType, .totalPaise'

# 5. Check shipments
curl -s https://dropflow-beta.vercel.app/api/v1/shipments \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" | jq '.data | length'
```

---

## Edge Cases & Negative Tests

Test these to verify error handling:

| # | Test | Expected |
|---|------|----------|
| 1 | Create product with empty name | 400 validation error |
| 2 | Create product with duplicate SKU | 409 conflict error |
| 3 | Create order with no items | 400 validation error |
| 4 | Create order with quantity = 0 | 400 validation error |
| 5 | Create order with invalid phone (missing +91) | 400 validation error |
| 6 | Create order with invalid PIN (not 6 digits) | 400 validation error |
| 7 | Update order to invalid status transition | Should reject or handle gracefully |
| 8 | Create invoice for non-existent order | 404 not found |
| 9 | Create invoice twice for same order | Returns existing invoice (idempotent) |
| 10 | API request without `x-e2e-test-key` header | 401 or redirect to auth |
| 11 | `GET /api/v1/catalog/products?page=-1` | Should handle gracefully |
| 12 | Update inventory with `delta` larger than stock | Should allow (stock can go negative) or reject |
| 13 | Create product with negative price | 400 validation error |
| 14 | Create order when product is out of stock | Should reject or handle gracefully |
| 15 | Very long buyer name (1000+ characters) | Should truncate or reject |

---

## Bug Reporting Template

When you find a bug, report it using this format:

```markdown
### Bug Title
[Short, descriptive title]

### Environment
- URL: https://dropflow-beta.vercel.app
- Browser/Tool: Chrome 130 / Postman / cURL
- Date & Time: 2026-03-31 14:30 IST

### Steps to Reproduce
1. Go to /orders/new
2. Add product "TSHIRT-BLK-M" with quantity 2
3. Fill in customer details
4. Click "Place Order"

### Expected Behavior
Order should be created and redirect to order detail page.

### Actual Behavior
Error toast appears: "Failed to create order". Console shows 500 error.

### Screenshots / Response Body
[Paste screenshot or API response JSON here]

### Severity
- [ ] Critical (app crashes, data loss)
- [ ] High (feature broken, no workaround)
- [ ] Medium (feature partially broken, workaround exists)
- [ ] Low (cosmetic, minor UX issue)
```

> Report bugs via the shared Slack channel or GitHub Issues at https://github.com/gengirish/dropflow/issues

---

## Appendix: Status Flow & Field Reference

### Order Status Flow

```
                              ┌──────────────┐
                              │   PENDING    │
                              └──────┬───────┘
                                     │
                              ┌──────▼───────┐
                              │  PAYMENT_    │
                              │  PENDING     │
                              └──────┬───────┘
                                     │
                              ┌──────▼───────┐
                              │  PAYMENT_    │
                              │  CONFIRMED   │
                              └──────┬───────┘
                                     │
                              ┌──────▼───────┐
                              │  PROCESSING  │
                              └──────┬───────┘
                                     │
                              ┌──────▼───────┐
                              │   SHIPPED    │──────┐
                              └──────┬───────┘      │
                                     │              │
                              ┌──────▼───────┐  ┌───▼────────┐
                              │  DELIVERED   │  │ CANCELLED  │
                              └──────────────┘  └────────────┘
```

### Product Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Product display name |
| `sku` | string | Yes | Unique per tenant |
| `supplierId` | string | Yes | Must exist in suppliers |
| `hsnCode` | string | Yes | Min 4 characters (Indian HS code) |
| `costPricePaise` | integer | Yes | In paise (₹1 = 100 paise) |
| `sellingPricePaise` | integer | Yes | In paise |
| `gstRatePercent` | number | Yes | One of: 0, 3, 5, 12, 18, 28 |
| `stockQty` | integer | No | Default: 0 |
| `lowStockThreshold` | integer | No | Default: 10 |
| `description` | string | No | |
| `images` | string[] | No | Array of URLs |

### Order Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `buyerName` | string | Yes | Customer name |
| `buyerEmail` | string | Yes | Valid email |
| `buyerPhone` | string | Yes | Format: `+91XXXXXXXXXX` |
| `shippingAddress.line1` | string | Yes | |
| `shippingAddress.line2` | string | No | Default: "" |
| `shippingAddress.city` | string | Yes | |
| `shippingAddress.state` | string | Yes | Indian state name |
| `shippingAddress.pin` | string | Yes | 6-digit PIN code |
| `shippingAddress.country` | string | No | Default: "IN" |
| `billingAddress` | object | Yes | Same structure as shipping |
| `items[].productId` | string | Yes | Must exist in catalog |
| `items[].quantity` | integer | Yes | Must be > 0 |
| `currency` | string | No | Default: "INR" |
| `notes` | string | No | |

### GST Rates by HSN

| HSN Code | Category | GST Rate |
|----------|----------|----------|
| 6109 | T-shirts | 5% |
| 6403 | Footwear (>₹1000) | 18% |
| 6211 | Kurta/ethnic wear | 12% |
| 3304 | Beauty/cosmetics | 28% |
| 0901 | Coffee/tea | 5% |

---

**Happy Testing! 🧪**

If you have questions, reach out on the team Slack channel or create a GitHub issue.
