# DropFlow Beta Testing Guide

**Version:** 2.0  
**Date:** 1 April 2026  
**Prepared by:** Engineering Team  

---

## Table of Contents

1. [App Overview](#app-overview)
2. [Environments & URLs](#environments--urls)
3. [Getting Started](#getting-started)
4. [Test Scenarios — Core](#test-scenarios--core)
   - [A. Catalog Management](#a-catalog-management)
   - [B. Order Lifecycle](#b-order-lifecycle)
   - [C. Finance & Invoicing](#c-finance--invoicing)
   - [D. Shipments](#d-shipments)
   - [E. Workflow Engine](#e-workflow-engine)
5. [Test Scenarios — Phase 4 Features](#test-scenarios--phase-4-features)
   - [F. RTO Prediction Engine](#f-rto-prediction-engine)
   - [G. Real-Time Margin Waterfall](#g-real-time-margin-waterfall)
   - [H. Multi-Channel Inventory Sync](#h-multi-channel-inventory-sync)
   - [I. Automated Supplier Scorecards](#i-automated-supplier-scorecards)
   - [J. Smart Reorder Engine](#j-smart-reorder-engine)
   - [K. Pincode Serviceability & Rate Engine](#k-pincode-serviceability--rate-engine)
   - [L. Notification Templates (WhatsApp/SMS/Email)](#l-notification-templates-whatsappsms-email)
   - [M. Returns & Refund Workflow](#m-returns--refund-workflow)
   - [N. Automated Reconciliation](#n-automated-reconciliation)
6. [Full API Reference](#full-api-reference)
7. [Edge Cases & Negative Tests](#edge-cases--negative-tests)
8. [Bug Reporting Template](#bug-reporting-template)
9. [Appendix](#appendix)

---

## App Overview

DropFlow is an order management and fulfillment platform for Indian D2C brands. It covers:

- **Catalog** — Products, suppliers, inventory management
- **Orders** — Order creation, status tracking, workflow automation
- **Payments** — Razorpay integration (test mode)
- **Invoicing** — GST-compliant invoice generation (CGST/SGST/IGST)
- **Shipments** — Shipment tracking and carrier integration
- **Workflow Engine** — DAG-based order fulfillment pipeline
- **RTO Prediction** — Score COD orders for return risk, auto-nudge prepaid
- **Margin Waterfall** — Per-order cost decomposition showing real margins
- **Multi-Channel Inventory** — Channel-level stock allocation with buffer rules
- **Supplier Scorecards** — Automated performance scoring with incident tracking
- **Smart Reorder** — Sales velocity tracking, stock-out alerts, auto-PO generation
- **Pincode Serviceability** — Carrier coverage database with rate engine
- **Notifications** — WhatsApp/SMS/Email templates triggered on order events
- **Returns & Refunds** — End-to-end return portal with QC and refund workflow
- **Reconciliation** — Auto-match payment settlements and COD remittances

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

### Dashboard Navigation

After signing in, the sidebar contains:

| Section | Page | Path |
|---------|------|------|
| Orders | Order list | `/orders` |
| Catalog | Products & suppliers | `/catalog` |
| Catalog | Supplier Scorecards | `/catalog/suppliers/scorecards` |
| Channels | Multi-channel inventory | `/channels` |
| Inventory | Reorder engine | `/inventory/reorder` |
| Returns | Returns management | `/returns` |
| Shipments | Shipment tracking | `/shipments` |
| Shipments | Pincode & rates | `/shipments/pincode` |
| Finance | Invoices & KPIs | `/finance` |
| Finance | Margin waterfall | `/finance/margins` |
| Finance | Reconciliation | `/finance/reconciliation` |
| Analytics | RTO prediction | `/analytics/rto` |
| Settings | Notifications | `/settings/notifications` |
| Settings | Workflows | `/settings/workflows` |

---

## Getting Started

### Option 1: UI Testing (Browser)

1. Open https://dropflow-beta.vercel.app
2. Click **Get Started** or **Sign In**
3. Create an account or use provided test credentials
4. You'll land on the dashboard with sidebar navigation

### Option 2: API Testing (Postman / cURL)

Base URL:
```
https://dropflow-beta.vercel.app/api/v1
```

All requests need the E2E header:
```
x-e2e-test-key: dropflow-e2e-test-secret-key-2024
```

---

## Test Scenarios — Core

### A. Catalog Management

#### A1. View Products

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to **/catalog** (or `GET /api/v1/catalog/products`) | Product list loads |
| 2 | Verify columns: Name, SKU, Price, Stock, GST Rate | All columns display correctly |
| 3 | Use the search box to filter by name | Table filters in real-time |

#### A2. Create a Product

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/catalog/products \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "name": "Test Kurta Set",
    "sku": "KURTA-BLU-L-'$(date +%s)'",
    "supplierId": "<SUPPLIER_ID>",
    "hsnCode": "6211",
    "costPricePaise": 45000,
    "sellingPricePaise": 89900,
    "gstRatePercent": 12,
    "stockQty": 50
  }'
```

**Expected:** 201 Created with product object.

#### A3. Create a Supplier

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

**Expected:** 201 Created with supplier object. Save the `id` for later tests.

---

### B. Order Lifecycle

#### B1. Create an Order

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "buyerName": "Priya Patel",
    "buyerEmail": "priya@test.com",
    "buyerPhone": "+919123456789",
    "paymentMethod": "COD",
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

**Expected:** 201 Created. Save `id` and `orderNumber`. Note `paymentMethod: "COD"` — this triggers RTO scoring automatically.

#### B2. Update Order Status

```bash
curl -X PATCH https://dropflow-beta.vercel.app/api/v1/orders/<ORDER_ID>/status \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{ "status": "SHIPPED", "note": "Picked from warehouse" }'
```

**Valid transitions:** `PENDING → PROCESSING → SHIPPED → DELIVERED`

---

### C. Finance & Invoicing

#### C1. Generate Invoice

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/invoices \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{ "orderId": "<ORDER_ID>" }'
```

**Expected:** Invoice with GST breakdown. Intra-state = CGST+SGST, Inter-state = IGST.

---

### D. Shipments

```bash
curl https://dropflow-beta.vercel.app/api/v1/shipments \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

---

### E. Workflow Engine

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create a new order | Status: PENDING |
| 2 | Open order detail in dashboard | Workflow panel shows DAG steps |
| 3 | Watch progress (page auto-polls) | Steps complete with checkmarks |

---

## Test Scenarios — Phase 4 Features

> These are the 9 new YC-demo features. Each section includes UI walkthrough + API commands.

### F. RTO Prediction Engine

**What it does:** Scores every COD order for Return-to-Origin risk based on pincode deliverability, payment method, buyer history, and order value. High-risk orders get a COD-to-prepaid nudge.

**Dashboard:** Navigate to `/analytics/rto`

#### F1. Score an Order for RTO Risk

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/rto/score \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{ "orderId": "<ORDER_ID>" }'
```

**Expected:** 202 Accepted (job enqueued to worker). The worker computes a risk score (0-100) and assigns a risk level (LOW/MEDIUM/HIGH/CRITICAL).

> Note: If you created the order with `paymentMethod: "COD"`, scoring is triggered automatically on order creation.

#### F2. View RTO Scores

```bash
curl "https://dropflow-beta.vercel.app/api/v1/rto/score?pageSize=10" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

**Expected:** Paginated list of RTO score logs with order details, risk level, and score.

#### F3. Send COD-to-Prepaid Nudge

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/rto/nudge \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{ "orderId": "<ORDER_ID>", "channel": "WHATSAPP" }'
```

**Expected:** 202 Accepted. Nudge job enqueued.

#### F4. RTO Analytics Dashboard

```bash
curl https://dropflow-beta.vercel.app/api/v1/rto/analytics \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

**Expected:** KPIs including `totalOrders`, `rtoRate`, `riskDistribution` (count per risk level), `codToPrePaidConversion`.

#### UI Walkthrough

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/analytics/rto` | RTO dashboard loads with KPI cards |
| 2 | View risk distribution chart | Shows LOW/MEDIUM/HIGH/CRITICAL breakdown |
| 3 | Review order table | Shows scored orders with risk level badges |

---

### G. Real-Time Margin Waterfall

**What it does:** Decomposes every order's revenue into: Selling Price → COGS → GST → Shipping → Gateway Fee → Packaging → Returns Reserve → Net Margin. Shows brands their *real* margin, not the illusory one.

**Dashboard:** Navigate to `/finance/margins`

#### G1. Margin Dashboard KPIs

```bash
curl https://dropflow-beta.vercel.app/api/v1/analytics/margins \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

**Expected:** Returns `avgMarginPercent`, `totalRevenuePaise`, `totalCostPaise`, `totalProfitPaise`, `topMarginProducts`, `worstMarginProducts`.

#### G2. Per-Order Margin Waterfall

```bash
curl https://dropflow-beta.vercel.app/api/v1/analytics/margins/<ORDER_ID> \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

**Expected:** Full waterfall breakdown with each cost component in paise and as a percentage of selling price.

> Note: Margin is computed asynchronously by the worker after order creation. Allow a few seconds before querying.

#### UI Walkthrough

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/finance/margins` | Margin dashboard loads with KPI cards |
| 2 | View waterfall chart | Visual bar chart showing revenue → costs → net margin |
| 3 | Review top/worst margin products | Tables showing best and worst performers |

---

### H. Multi-Channel Inventory Sync

**What it does:** Single source of truth inventory with channel-level stock allocation. Supports buffer rules (e.g., show only 80% of stock on Amazon).

**Dashboard:** Navigate to `/channels`

#### H1. Create a Sales Channel

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "name": "My Website",
    "type": "WEBSITE",
    "bufferPercent": 100
  }'
```

**Expected:** 201 Created. Valid types: `WEBSITE`, `AMAZON`, `FLIPKART`, `MEESHO`, `SHOPIFY`, `CUSTOM`.

#### H2. Add Product Listing to Channel

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/channels/<CHANNEL_ID>/listings \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "channelId": "<CHANNEL_ID>",
    "productId": "<PRODUCT_ID>",
    "channelSku": "WEB-KURTA-001",
    "isActive": true
  }'
```

#### H3. Allocate Stock to Channel

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/channels/<CHANNEL_ID>/stock \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "channelId": "<CHANNEL_ID>",
    "productId": "<PRODUCT_ID>",
    "allocatedQty": 100
  }'
```

#### H4. View Multi-Channel Inventory Snapshot

```bash
curl https://dropflow-beta.vercel.app/api/v1/channels/inventory \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

**Expected:** Snapshot of stock across all channels with visible/allocated/reserved quantities.

#### UI Walkthrough

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/channels` | Channel list with cards |
| 2 | Click a channel | Channel detail with listings and stock |
| 3 | View stock overview tab | Cross-channel inventory comparison |

---

### I. Automated Supplier Scorecards

**What it does:** Tracks per-supplier performance metrics: on-time fulfillment rate, defect rate, lead time accuracy, PO acceptance rate, return rate. Generates monthly scorecards.

**Dashboard:** Navigate to `/catalog/suppliers/scorecards`

#### I1. Log a Supplier Incident

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/suppliers/incidents \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "supplierId": "<SUPPLIER_ID>",
    "type": "LATE_DELIVERY",
    "severity": "MEDIUM",
    "description": "PO #1234 arrived 3 days late"
  }'
```

**Incident types:** `LATE_DELIVERY`, `WRONG_ITEM`, `QUALITY_ISSUE`, `SHORT_SHIPMENT`, `DAMAGED_GOODS`, `COMMUNICATION_ISSUE`, `OTHER`

**Severity levels:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

#### I2. Trigger Scorecard Computation

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/suppliers/scorecards \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{ "period": "2026-04", "supplierId": "<SUPPLIER_ID>" }'
```

#### I3. View Supplier Rankings

```bash
curl https://dropflow-beta.vercel.app/api/v1/suppliers/rankings \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

**Expected:** Suppliers ranked by overall score with performance breakdown.

#### UI Walkthrough

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/catalog/suppliers/scorecards` | Scorecard list and incident log |
| 2 | View scorecard for a supplier | Performance metrics and trend |
| 3 | Log an incident using the form | Incident appears in the list |

---

### J. Smart Reorder Engine

**What it does:** Tracks sales velocity per SKU, calculates days-of-stock-remaining, and alerts when stock hits the reorder point. Can auto-generate POs.

**Dashboard:** Navigate to `/inventory/reorder`

#### J1. Create a Reorder Rule

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/reorder/rules \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "productId": "<PRODUCT_ID>",
    "reorderPoint": 30,
    "reorderQty": 100,
    "maxStockQty": 500,
    "isAutoPoEnabled": false
  }'
```

#### J2. View Stock Forecast

```bash
curl https://dropflow-beta.vercel.app/api/v1/reorder/forecast \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

**Expected:** Array of products with `currentStock`, `salesVelocityDaily`, `daysOfStockRemaining`, `reorderPoint`, `status` (OK/LOW/CRITICAL).

#### J3. View Reorder Alerts

```bash
curl https://dropflow-beta.vercel.app/api/v1/reorder/alerts \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

#### J4. Trigger Reorder Check

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/reorder/run \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{}'
```

**Expected:** Enqueues velocity computation + reorder check for all products.

#### UI Walkthrough

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/inventory/reorder` | Stock forecast table and alerts |
| 2 | Create a reorder rule for a product | Rule appears in rules list |
| 3 | Click "Run Reorder Check" button | Triggers velocity computation |
| 4 | View alerts tab | Shows products below reorder point |

---

### K. Pincode Serviceability & Rate Engine

**What it does:** Pincode-level serviceability database for all major Indian carriers. At order creation, finds the cheapest carrier that serves the destination PIN.

**Dashboard:** Navigate to `/shipments/pincode`

#### K1. Check Pincode Serviceability

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/pincode/check \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{ "pincode": "560041", "weightGrams": 500, "isCod": true }'
```

**Expected:** Returns `isServiceable`, list of `carriers` with estimated delivery days and rates.

#### K2. Bulk Check Pincodes

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/pincode/bulk-check \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{ "pincodes": ["560041", "110001", "400001", "700001"] }'
```

#### K3. Seed Pincode Serviceability Data

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/pincode/serviceability \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "records": [
      {
        "pincode": "560041",
        "carrier": "DELHIVERY",
        "isServiceable": true,
        "isCodAvailable": true,
        "estimatedDays": 3,
        "zone": "SOUTH-1"
      }
    ]
  }'
```

#### K4. Create Carrier Rate

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/pincode/rates \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "carrier": "DELHIVERY",
    "zone": "SOUTH-1",
    "minWeightGrams": 0,
    "maxWeightGrams": 1000,
    "basePricePaise": 6500,
    "additionalPerGramPaise": 0.5,
    "codChargePaise": 3500,
    "fuelSurchargePercent": 15,
    "validFrom": "2026-01-01"
  }'
```

#### UI Walkthrough

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/shipments/pincode` | Pincode checker and rate cards |
| 2 | Enter a pincode in the checker | Shows serviceability and available carriers |
| 3 | View carrier rates table | Rates by zone, weight slab, COD charge |

---

### L. Notification Templates (WhatsApp/SMS/Email)

**What it does:** Automated notifications at each order status change. Pre-built templates for order confirmed, shipped, delivered, COD nudge. Uses WhatsApp Business API.

**Dashboard:** Navigate to `/settings/notifications`

#### L1. Create a Notification Template

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/notifications/templates \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "channel": "WHATSAPP",
    "triggerEvent": "order.shipped",
    "name": "Shipping Update",
    "templateBody": "Hi {{buyerName}}! Your order {{orderNumber}} has been shipped. Track: {{trackingUrl}}",
    "variables": ["buyerName", "orderNumber", "trackingUrl"],
    "isActive": true
  }'
```

**Channels:** `WHATSAPP`, `SMS`, `EMAIL`, `IN_APP`

**Trigger events:** `order.confirmed`, `order.shipped`, `order.delivered`, `order.cancelled`, `cod.nudge`, `return.approved`, `refund.processed`

#### L2. Send a Test Notification

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "orderId": "<ORDER_ID>",
    "channel": "IN_APP",
    "triggerEvent": "order.confirmed",
    "variables": {
      "buyerName": "Test User",
      "orderNumber": "ORD-TEST-001",
      "totalAmount": "999"
    }
  }'
```

#### L3. View Notification Logs

```bash
curl https://dropflow-beta.vercel.app/api/v1/notifications/logs \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

#### UI Walkthrough

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/settings/notifications` | Template list and log viewer |
| 2 | Create a new template | Template appears in list |
| 3 | Toggle a template active/inactive | Status updates |
| 4 | View notification logs | History of sent notifications |

---

### M. Returns & Refund Workflow

**What it does:** Customer-facing return portal (select items → reason → auto-label). Internal workflow: return received → QC → restock/dispose → refund. Tracks reverse logistics separately.

**Dashboard:** Navigate to `/returns`

#### M1. Setup: Move Order to DELIVERED

Before testing returns, the order must be delivered:

```bash
# Mark as SHIPPED first
curl -X PATCH https://dropflow-beta.vercel.app/api/v1/orders/<ORDER_ID>/status \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{ "status": "SHIPPED", "note": "Test" }'

# Then mark as DELIVERED
curl -X PATCH https://dropflow-beta.vercel.app/api/v1/orders/<ORDER_ID>/status \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{ "status": "DELIVERED", "note": "Test" }'
```

#### M2. Create a Return Request

First, get the order items:
```bash
curl https://dropflow-beta.vercel.app/api/v1/orders/<ORDER_ID> \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

Then create the return:
```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/returns \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "orderId": "<ORDER_ID>",
    "reason": "SIZE_ISSUE",
    "customerNotes": "Size too large, need M instead of L",
    "items": [
      {
        "orderItemId": "<ORDER_ITEM_ID>",
        "productId": "<PRODUCT_ID>",
        "quantity": 1,
        "reason": "SIZE_ISSUE"
      }
    ]
  }'
```

**Return reasons:** `SIZE_ISSUE`, `DEFECTIVE`, `WRONG_ITEM`, `NOT_AS_DESCRIBED`, `CHANGED_MIND`, `DAMAGED_IN_TRANSIT`, `MISSING_PARTS`, `OTHER`

**Expected:** 201 Created with `status: "REQUESTED"` and a return number (`RET-XXXX`).

#### M3. Approve the Return

```bash
curl -X PATCH https://dropflow-beta.vercel.app/api/v1/returns/<RETURN_ID> \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{ "status": "APPROVED" }'
```

#### M4. View Return Detail

```bash
curl https://dropflow-beta.vercel.app/api/v1/returns/<RETURN_ID> \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

#### M5. Returns Analytics

```bash
curl https://dropflow-beta.vercel.app/api/v1/returns/analytics \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

**Expected:** `totalReturns`, `returnRate`, `avgResolutionDays`, breakdown by reason.

#### UI Walkthrough

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/returns` | Returns list with KPI cards |
| 2 | Click a return request | Detail page with timeline, items, refund status |
| 3 | Update status (Approve, QC Pass, etc.) | Status badge updates |
| 4 | View analytics tab | Return rate trends and reason breakdown |

---

### N. Automated Reconciliation

**What it does:** Auto-matches Razorpay settlements to orders, carrier COD remittances to deliveries. Flags discrepancies. Shows reconciliation dashboard.

**Dashboard:** Navigate to `/finance/reconciliation`

#### N1. Import a Payment Gateway Settlement

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/reconciliation/settlements \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "gateway": "RAZORPAY",
    "settlementId": "SETL-TEST-001",
    "settlementDate": "2026-04-01T00:00:00Z",
    "totalAmountPaise": 199800,
    "feePaise": 3996,
    "taxOnFeePaise": 719,
    "netAmountPaise": 195085,
    "utrNumber": "UTR-123456",
    "items": [
      {
        "gatewayPaymentId": "pay_test_001",
        "amountPaise": 199800,
        "feePaise": 3996,
        "taxPaise": 719,
        "netPaise": 195085
      }
    ]
  }'
```

#### N2. Import a COD Remittance

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/reconciliation/cod-remittances \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{
    "carrier": "DELHIVERY",
    "remittanceId": "COD-TEST-001",
    "remittanceDate": "2026-04-01T00:00:00Z",
    "totalAmountPaise": 99900,
    "deductionsPaise": 2500,
    "netAmountPaise": 97400,
    "items": [
      {
        "awbNumber": "AWB-TEST-001",
        "amountPaise": 99900,
        "codChargePaise": 2500,
        "netPaise": 97400
      }
    ]
  }'
```

#### N3. View Reconciliation Records

```bash
curl https://dropflow-beta.vercel.app/api/v1/reconciliation/records \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

#### N4. Reconciliation Analytics

```bash
curl https://dropflow-beta.vercel.app/api/v1/reconciliation/analytics \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024"
```

**Expected:** `totalRecords`, `matchedCount`, `unmatchedCount`, `discrepancyCount`, `matchRate`.

#### N5. Trigger Auto-Reconcile

```bash
curl -X POST https://dropflow-beta.vercel.app/api/v1/reconciliation/auto-reconcile \
  -H "Content-Type: application/json" \
  -H "x-e2e-test-key: dropflow-e2e-test-secret-key-2024" \
  -d '{}'
```

#### UI Walkthrough

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/finance/reconciliation` | Dashboard with KPIs and tabs |
| 2 | View Settlements tab | List of imported gateway settlements |
| 3 | View COD Remittances tab | List of carrier remittances |
| 4 | View Records tab | Matched/unmatched reconciliation records |
| 5 | Click "Auto Reconcile" button | Triggers matching engine |
| 6 | Import a settlement | Record appears with match status |

---

## Full API Reference

### Core APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/catalog/products` | List products |
| `POST` | `/api/v1/catalog/products` | Create product |
| `GET` | `/api/v1/catalog/suppliers` | List suppliers |
| `POST` | `/api/v1/catalog/suppliers` | Create supplier |
| `PATCH` | `/api/v1/catalog/inventory/:id` | Update stock |
| `GET` | `/api/v1/orders` | List orders |
| `POST` | `/api/v1/orders` | Create order |
| `GET` | `/api/v1/orders/:id` | Order detail |
| `PATCH` | `/api/v1/orders/:id/status` | Update status |
| `POST` | `/api/v1/invoices` | Create invoice |
| `GET` | `/api/v1/invoices` | List invoices |
| `GET` | `/api/v1/shipments` | List shipments |
| `GET` | `/api/v1/analytics/dashboard` | Dashboard KPIs |

### RTO Prediction

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/rto/score` | Score order for RTO risk |
| `GET` | `/api/v1/rto/score` | List RTO scores |
| `POST` | `/api/v1/rto/nudge` | Send COD-to-prepaid nudge |
| `GET` | `/api/v1/rto/analytics` | RTO dashboard KPIs |

### Margin Waterfall

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/analytics/margins` | Margin dashboard KPIs |
| `GET` | `/api/v1/analytics/margins/:orderId` | Per-order margin waterfall |

### Multi-Channel Inventory

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/channels` | List channels |
| `POST` | `/api/v1/channels` | Create channel |
| `GET` | `/api/v1/channels/:id` | Channel detail |
| `PATCH` | `/api/v1/channels/:id` | Update channel |
| `DELETE` | `/api/v1/channels/:id` | Delete channel |
| `GET` | `/api/v1/channels/:id/listings` | Channel listings |
| `POST` | `/api/v1/channels/:id/listings` | Add listing |
| `GET` | `/api/v1/channels/:id/stock` | Stock allocations |
| `POST` | `/api/v1/channels/:id/stock` | Set allocation |
| `GET` | `/api/v1/channels/inventory` | Cross-channel snapshot |

### Supplier Scorecards

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/suppliers/scorecards` | List scorecards |
| `POST` | `/api/v1/suppliers/scorecards` | Trigger computation |
| `GET` | `/api/v1/suppliers/:id/scorecard` | Supplier scorecard |
| `GET` | `/api/v1/suppliers/incidents` | List incidents |
| `POST` | `/api/v1/suppliers/incidents` | Create incident |
| `GET` | `/api/v1/suppliers/rankings` | Supplier rankings |

### Smart Reorder

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/reorder/rules` | List rules |
| `POST` | `/api/v1/reorder/rules` | Create/upsert rule |
| `GET` | `/api/v1/reorder/rules/:productId` | Rule for product |
| `PATCH` | `/api/v1/reorder/rules/:productId` | Update rule |
| `DELETE` | `/api/v1/reorder/rules/:productId` | Delete rule |
| `GET` | `/api/v1/reorder/alerts` | List alerts |
| `POST` | `/api/v1/reorder/alerts` | Acknowledge alert |
| `GET` | `/api/v1/reorder/forecast` | Stock forecast |
| `POST` | `/api/v1/reorder/run` | Trigger reorder check |

### Pincode Serviceability

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/pincode/check` | Check pincode |
| `POST` | `/api/v1/pincode/bulk-check` | Bulk check |
| `GET` | `/api/v1/pincode/rates` | List carrier rates |
| `POST` | `/api/v1/pincode/rates` | Create rate |
| `GET` | `/api/v1/pincode/serviceability` | List serviceability |
| `POST` | `/api/v1/pincode/serviceability` | Bulk seed data |

### Notifications

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/notifications/templates` | List templates |
| `POST` | `/api/v1/notifications/templates` | Create template |
| `GET` | `/api/v1/notifications/templates/:id` | Template detail |
| `PATCH` | `/api/v1/notifications/templates/:id` | Update template |
| `DELETE` | `/api/v1/notifications/templates/:id` | Delete template |
| `POST` | `/api/v1/notifications/send` | Send notification |
| `GET` | `/api/v1/notifications/logs` | Notification logs |

### Returns & Refunds

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/returns` | List returns |
| `POST` | `/api/v1/returns` | Create return |
| `GET` | `/api/v1/returns/:id` | Return detail |
| `PATCH` | `/api/v1/returns/:id` | Update status |
| `POST` | `/api/v1/returns/:id/refund` | Initiate refund |
| `GET` | `/api/v1/returns/analytics` | Returns KPIs |

### Reconciliation

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/reconciliation/settlements` | List settlements |
| `POST` | `/api/v1/reconciliation/settlements` | Import settlement |
| `GET` | `/api/v1/reconciliation/cod-remittances` | List COD remittances |
| `POST` | `/api/v1/reconciliation/cod-remittances` | Import remittance |
| `GET` | `/api/v1/reconciliation/records` | Reconciliation records |
| `POST` | `/api/v1/reconciliation/match` | Manual match |
| `GET` | `/api/v1/reconciliation/analytics` | Reconciliation KPIs |
| `POST` | `/api/v1/reconciliation/auto-reconcile` | Trigger auto-match |

---

## Edge Cases & Negative Tests

| # | Test | Expected |
|---|------|----------|
| 1 | Create product with empty name | 400 validation error |
| 2 | Create product with duplicate SKU | 409 conflict |
| 3 | Create order with no items | 400 validation error |
| 4 | Create order with quantity = 0 | 400 validation error |
| 5 | API request without `x-e2e-test-key` header | 401 unauthorized |
| 6 | Create return for non-DELIVERED order | Should reject |
| 7 | Create return after return window expired | Should reject |
| 8 | Import duplicate settlement (same settlementId) | 409 conflict |
| 9 | Import duplicate COD remittance | 409 conflict |
| 10 | Create channel with invalid type | 400 validation |
| 11 | Allocate more stock than product has | Should handle or reject |
| 12 | Create reorder rule with reorderPoint > maxStockQty | Should validate |
| 13 | Check serviceability for invalid pincode (3 digits) | 400 validation |
| 14 | Create notification template with missing variables | Should validate |
| 15 | Score a non-existent order for RTO | 404 not found |

---

## Bug Reporting Template

```markdown
### Bug Title
[Short, descriptive title]

### Environment
- URL: https://dropflow-beta.vercel.app
- Browser/Tool: Chrome / Postman / cURL
- Date & Time: YYYY-MM-DD HH:MM IST

### Steps to Reproduce
1. ...
2. ...

### Expected Behavior
...

### Actual Behavior
...

### Screenshots / Response Body
[Paste screenshot or API response JSON]

### Severity
- [ ] Critical (app crashes, data loss)
- [ ] High (feature broken, no workaround)
- [ ] Medium (feature partially broken)
- [ ] Low (cosmetic, minor UX issue)
```

> Report bugs via GitHub Issues at https://github.com/gengirish/dropflow/issues

---

## Appendix

### Suggested Full Test Run (Copy-Paste Script)

Run these commands in order, saving IDs as you go:

```bash
BASE="https://dropflow-beta.vercel.app/api/v1"
H="x-e2e-test-key: dropflow-e2e-test-secret-key-2024"

# 1. Create supplier
curl -s -X POST "$BASE/catalog/suppliers" \
  -H "Content-Type: application/json" -H "$H" \
  -d '{"name":"Beta Test Supplier","contactEmail":"beta@test.com","leadTimeDays":5}' | jq '.data.id'
# → Save as SUPPLIER_ID

# 2. Create product
curl -s -X POST "$BASE/catalog/products" \
  -H "Content-Type: application/json" -H "$H" \
  -d '{"name":"Beta Test Kurta","sku":"BETA-'$(date +%s)'","supplierId":"<SUPPLIER_ID>","hsnCode":"6211","costPricePaise":40000,"sellingPricePaise":99900,"gstRatePercent":12,"stockQty":200}' | jq '.data.id'
# → Save as PRODUCT_ID

# 3. Create COD order (triggers RTO scoring)
curl -s -X POST "$BASE/orders" \
  -H "Content-Type: application/json" -H "$H" \
  -d '{"buyerName":"Beta Tester","buyerEmail":"beta@test.com","buyerPhone":"+919876543210","paymentMethod":"COD","shippingAddress":{"line1":"42 MG Road","city":"Bangalore","state":"Karnataka","pin":"560001","country":"IN"},"billingAddress":{"line1":"42 MG Road","city":"Bangalore","state":"Karnataka","pin":"560001","country":"IN"},"items":[{"productId":"<PRODUCT_ID>","quantity":2}]}' | jq '.data.id, .data.orderNumber'
# → Save as ORDER_ID

# 4. Check RTO analytics
curl -s "$BASE/rto/analytics" -H "$H" | jq '.data'

# 5. Check margin waterfall
curl -s "$BASE/analytics/margins" -H "$H" | jq '.data'

# 6. Create channel + listing + allocation
curl -s -X POST "$BASE/channels" -H "Content-Type: application/json" -H "$H" \
  -d '{"name":"Beta Website","type":"WEBSITE","bufferPercent":80}' | jq '.data.id'
# → Save as CHANNEL_ID

# 7. Check pincode serviceability
curl -s -X POST "$BASE/pincode/check" -H "Content-Type: application/json" -H "$H" \
  -d '{"pincode":"560001","weightGrams":500,"isCod":true}' | jq '.data'

# 8. Create reorder rule
curl -s -X POST "$BASE/reorder/rules" -H "Content-Type: application/json" -H "$H" \
  -d '{"productId":"<PRODUCT_ID>","reorderPoint":30,"reorderQty":100,"maxStockQty":500,"isAutoPoEnabled":false}' | jq '.data'

# 9. Move order to DELIVERED (for returns test)
curl -s -X PATCH "$BASE/orders/<ORDER_ID>/status" -H "Content-Type: application/json" -H "$H" \
  -d '{"status":"SHIPPED","note":"test"}'
curl -s -X PATCH "$BASE/orders/<ORDER_ID>/status" -H "Content-Type: application/json" -H "$H" \
  -d '{"status":"DELIVERED","note":"test"}'

# 10. Create return request
curl -s "$BASE/orders/<ORDER_ID>" -H "$H" | jq '.data.items[0].id'
# → Save as ORDER_ITEM_ID

curl -s -X POST "$BASE/returns" -H "Content-Type: application/json" -H "$H" \
  -d '{"orderId":"<ORDER_ID>","reason":"SIZE_ISSUE","customerNotes":"Too large","items":[{"orderItemId":"<ORDER_ITEM_ID>","productId":"<PRODUCT_ID>","quantity":1,"reason":"SIZE_ISSUE"}]}' | jq '.data.id, .data.status'

# 11. Import settlement for reconciliation
curl -s -X POST "$BASE/reconciliation/settlements" -H "Content-Type: application/json" -H "$H" \
  -d '{"gateway":"RAZORPAY","settlementId":"SETL-BETA-'$(date +%s)'","settlementDate":"2026-04-01T00:00:00Z","totalAmountPaise":199800,"feePaise":3996,"taxOnFeePaise":719,"netAmountPaise":195085,"utrNumber":"UTR-BETA","items":[{"gatewayPaymentId":"pay_beta_001","amountPaise":199800,"feePaise":3996,"taxPaise":719,"netPaise":195085}]}' | jq '.data'

# 12. Reconciliation analytics
curl -s "$BASE/reconciliation/analytics" -H "$H" | jq '.data'
```

### Order Status Flow

```
PENDING → PROCESSING → SHIPPED → DELIVERED
                                      ↓
                               RETURN REQUESTED
                                      ↓
                               RETURN APPROVED
                                      ↓
                              QC PASSED / FAILED
                                      ↓
                                  REFUNDED
```

### GST Rates by HSN

| HSN Code | Category | GST Rate |
|----------|----------|----------|
| 6109 | T-shirts | 5% |
| 6403 | Footwear (>₹1000) | 18% |
| 6211 | Kurta/ethnic wear | 12% |
| 3304 | Beauty/cosmetics | 28% |
| 0901 | Coffee/tea | 5% |

---

**Happy Testing!**

Questions? Reach out on Slack or file a GitHub issue at https://github.com/gengirish/dropflow/issues
