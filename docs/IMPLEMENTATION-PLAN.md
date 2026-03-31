# DropFlow — YC Feature Implementation Plan

## Parallel Agent Execution Strategy

Each **Sprint** runs 3-5 agents in parallel. Agents are grouped by dependency:
- **Schema Agent** runs first (DB migrations must land before API/UI work)
- **API Agent**, **UI Agent**, **Worker Agent** run in parallel after schema is ready
- **Test Agent** runs after API + UI are complete

```
Sprint timeline (per phase):

  Day 1          Day 2-3              Day 4-5           Day 6
  ┌──────┐    ┌───────────────┐    ┌──────────────┐   ┌──────┐
  │Schema│───►│ API ║ UI ║ WK │───►│ Integration  │──►│ Test │
  │Agent │    │ ═══ ║ ══ ║ ══ │    │   Wiring     │   │Agent │
  └──────┘    └───────────────┘    └──────────────┘   └──────┘
                  PARALLEL              MERGE
```

---

## Phase 1: Demo Day Features (Sprint 1-2)

### Feature 1.1: Real-Time Unit Economics Engine

**Value:** Show per-SKU P&L → Revenue - COGS - GST - Shipping - Gateway fees - Returns = True margin

#### Agent A1: Schema + Types (runs first)

**Files to create/modify:**

1. **`packages/db/prisma/schema.prisma`** — Add models:
```prisma
model SkuEconomics {
  id                String   @id @default(cuid())
  tenantId          String
  productId         String
  product           Product  @relation(fields: [productId], references: [id])
  period            String   // "2024-01" monthly aggregation
  unitsSold         Int      @default(0)
  unitsReturned     Int      @default(0)
  revenuePaise      Int      @default(0)
  cogsPaise         Int      @default(0)
  gstPaise          Int      @default(0)
  shippingPaise     Int      @default(0)
  gatewayFeePaise   Int      @default(0)
  returnCostPaise   Int      @default(0)
  netProfitPaise    Int      @default(0)
  marginPercent     Float    @default(0)
  computedAt        DateTime @default(now())

  @@unique([tenantId, productId, period])
  @@index([tenantId])
  @@map("sku_economics")
}

model DailyRevenue {
  id              String   @id @default(cuid())
  tenantId        String
  date            DateTime @db.Date
  orderCount      Int      @default(0)
  revenuePaise    Int      @default(0)
  cogsPaise       Int      @default(0)
  profitPaise     Int      @default(0)
  avgOrderValue   Int      @default(0)
  topSkuId        String?
  computedAt      DateTime @default(now())

  @@unique([tenantId, date])
  @@index([tenantId])
  @@map("daily_revenue")
}
```

2. **`packages/types/src/analytics.ts`** — New file:
```typescript
// Zod schemas for:
// - AnalyticsDateRange (from/to/granularity)
// - SkuEconomicsResponse
// - DashboardKPIResponse (totalRevenue, totalProfit, avgMargin, topSKUs, worstSKUs)
// - RevenueTimeSeriesResponse
```

3. **`packages/config/src/constants.ts`** — Add:
```typescript
export const ANALYTICS = {
  GATEWAY_FEE_PERCENT: 2, // Razorpay standard
  RECOMPUTE_INTERVAL_HOURS: 1,
} as const;
```

4. **`packages/config/src/enums.ts`** — Add:
```typescript
export const AnalyticsGranularity = { DAILY: "DAILY", WEEKLY: "WEEKLY", MONTHLY: "MONTHLY" } as const;
```

**Commands:** `pnpm db:migrate` → `pnpm --filter @dropflow/types build` → `pnpm --filter @dropflow/config build`

---

#### Agent B1: API Routes (parallel after A1)

**Files to create:**

1. **`apps/web/src/app/api/v1/analytics/unit-economics/route.ts`**
   - `GET` — Compute or fetch cached per-SKU economics for tenant
   - Query params: `period`, `sortBy` (margin/revenue/units), `limit`
   - Logic: Join orders + order_items + payments + shipments + invoices
   - Aggregate: revenue, COGS (costPricePaise × qty), GST from invoice lines, shipping from shipment, gateway fees (2% of payment amount), return costs
   - Return sorted SKU array with margin breakdown

2. **`apps/web/src/app/api/v1/analytics/dashboard/route.ts`**
   - `GET` — KPI summary for tenant
   - Returns: totalRevenue (30d), totalProfit, avgMargin%, topSKUs (by margin), worstSKUs (negative/low margin), orderCount, returnRate%
   - Uses materialized `DailyRevenue` + live query fallback

3. **`apps/web/src/app/api/v1/analytics/revenue/route.ts`**
   - `GET` — Time series revenue data
   - Query: `from`, `to`, `granularity` (daily/weekly/monthly)
   - Returns: `[{ date, revenue, profit, orders }]` for charting

---

#### Agent C1: Dashboard UI (parallel after A1)

**Files to create/modify:**

1. **`apps/web/src/app/(dashboard)/analytics/page.tsx`** — New analytics page:
   - Top row: 4 KPI cards (Revenue, Profit, Avg Margin, Return Rate) using Tremor `Card`
   - Second row: Revenue vs Profit area chart (Tremor `AreaChart`) with date range picker
   - Third row: SKU Economics table — sortable by margin, color-coded (green >20%, yellow 10-20%, red <10%)
   - Each SKU row expands to show cost breakdown waterfall

2. **`apps/web/src/components/analytics/kpi-card.tsx`** — Reusable KPI card
3. **`apps/web/src/components/analytics/sku-table.tsx`** — SKU economics table with expansion
4. **`apps/web/src/components/analytics/revenue-chart.tsx`** — Time series chart

**shadcn components needed:** `npx shadcn@latest add tabs sheet separator tooltip`
**New dependency:** `pnpm --filter web add @tremor/react recharts`

5. **`apps/web/src/app/(dashboard)/layout.tsx`** — Add "Analytics" nav link

---

#### Agent D1: Worker — Economics Compute Job (parallel after A1)

**Files to create/modify:**

1. **`packages/config/src/constants.ts`** — Add queue:
```typescript
QUEUE_NAMES.ANALYTICS = "analytics-queue"
```

2. **`apps/worker/src/workers/analytics-worker.ts`** — New worker:
   - Consumes `analytics-queue` jobs
   - Job types: `compute-sku-economics`, `compute-daily-revenue`
   - Runs SQL aggregation queries, upserts into `SkuEconomics` / `DailyRevenue`
   - Triggered: on order status change to DELIVERED, on return, on scheduled cron

3. **`apps/worker/src/queues/index.ts`** — Register analytics queue
4. **`apps/worker/src/index.ts`** — Start analytics worker

---

### Feature 1.2: Visual Workflow Builder

**Value:** Drag-and-drop DAG editor → no-code automation for ops teams

#### Agent A2: Schema + Types (runs first)

**Files to modify:**

1. **`packages/types/src/workflow.ts`** — Add:
```typescript
export const WorkflowNodeInput = z.object({
  id: z.string(),
  type: z.enum(["action", "condition", "delay", "webhook", "approval"]),
  handler: z.string(),
  label: z.string(),
  config: z.record(z.unknown()).default({}),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const WorkflowEdgeInput = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  condition: z.string().optional(),
});

export const SaveWorkflowInput = z.object({
  name: z.string().min(1),
  trigger: z.string(),
  nodes: z.array(WorkflowNodeInput),
  edges: z.array(WorkflowEdgeInput),
});
```

---

#### Agent B2: API Routes (parallel after A2)

**Files to create:**

1. **`apps/web/src/app/api/v1/workflows/route.ts`**
   - `GET` — List workflow definitions for tenant
   - `POST` — Create/update workflow definition (upsert by name+version)
   - Validates DAG is acyclic, all handlers exist in step-registry

2. **`apps/web/src/app/api/v1/workflows/[id]/route.ts`**
   - `GET` — Single workflow with full DAG JSON
   - `PUT` — Update nodes/edges
   - `DELETE` — Archive (soft delete)

3. **`apps/web/src/app/api/v1/workflows/[id]/runs/route.ts`**
   - `GET` — List runs for a workflow with status/timing

---

#### Agent C2: Workflow Builder UI (parallel after A2)

**Files to create/modify:**

1. **New dependency:** `pnpm --filter web add @xyflow/react`

2. **`apps/web/src/app/(dashboard)/settings/workflows/page.tsx`** — Workflow list page
3. **`apps/web/src/app/(dashboard)/settings/workflows/[id]/page.tsx`** — Workflow editor page

4. **`apps/web/src/components/workflow/`** — New folder:
   - `workflow-canvas.tsx` — React Flow canvas with controls, minimap, background
   - `custom-nodes/action-node.tsx` — Action step node (icon + label + config button)
   - `custom-nodes/condition-node.tsx` — Diamond-shaped condition node with true/false handles
   - `custom-nodes/delay-node.tsx` — Timer node
   - `custom-nodes/approval-node.tsx` — Human approval gate
   - `node-config-panel.tsx` — Sheet/drawer for configuring selected node
   - `node-palette.tsx` — Sidebar with draggable node types
   - `toolbar.tsx` — Save, validate, activate/pause, run test buttons

5. **`apps/web/src/app/(dashboard)/settings/page.tsx`** — Replace "Coming soon" with settings hub linking to workflows

---

### Feature 1.3: Multi-Channel Notifications (WhatsApp + Email + In-App)

**Value:** Order updates via WhatsApp (India's default), email, and in-app — not just DB status changes

#### Agent A3: Worker Notification System (standalone)

**Files to create/modify:**

1. **`apps/worker/src/lib/notifications.ts`** — Notification dispatcher:
   - `sendWhatsApp(phone, templateId, params)` — Twilio/WhatsApp Business API
   - `sendEmail(to, subject, html)` — Resend SDK
   - `sendInApp(tenantId, userId, message)` — SSE broadcast via existing broadcaster

2. **`apps/worker/src/workers/notification-worker.ts`** — New worker:
   - Consumes notification jobs from a new `notification-queue`
   - Routes to correct channel based on job payload

3. **`packages/config/src/constants.ts`** — Add:
```typescript
QUEUE_NAMES.NOTIFICATION = "notification-queue"
```

4. **`apps/worker/src/dag/steps/notify-buyer.ts`** — New workflow step:
   - Sends order confirmation via WhatsApp + email after order creation
   - Template: "Your order {orderNumber} has been placed. Track at {url}"

5. **Wire into existing steps:**
   - `create-shipment.ts` → enqueue notification "Your order has been shipped, AWB: {awb}"
   - After workflow completion → enqueue "Order delivered" notification

---

## Phase 2: Core Value Features (Sprint 3-4)

### Feature 2.1: Multi-Channel Order Aggregation

**Value:** Unified orders from Shopify, Amazon IN, Flipkart, Meesho

#### Agent A4: Schema + Channel Adapters (runs first)

1. **`packages/db/prisma/schema.prisma`** — Add to Order model:
```prisma
  channelSource     String?    // "SHOPIFY" | "AMAZON_IN" | "FLIPKART" | "MEESHO" | "MANUAL"
  channelOrderId    String?    // External order ID from channel
  channelData       Json?      // Raw channel payload for audit
```

2. **`packages/db/prisma/schema.prisma`** — New model:
```prisma
model SalesChannel {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  platform      String   // SHOPIFY, AMAZON_IN, FLIPKART, MEESHO
  displayName   String
  credentials   Json     // Encrypted API keys/tokens
  webhookSecret String?
  isActive      Boolean  @default(true)
  lastSyncAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([tenantId, platform])
  @@index([tenantId])
  @@map("sales_channels")
}
```

3. **`packages/types/src/channel.ts`** — Channel schemas

---

#### Agent B4: Channel Adapter Workers (parallel after A4)

1. **`apps/worker/src/channels/`** — New folder:
   - `base-adapter.ts` — Abstract adapter interface:
     ```typescript
     interface ChannelAdapter {
       pullOrders(since: Date): Promise<NormalizedOrder[]>;
       pushStatus(channelOrderId: string, status: string): void;
       validateWebhook(payload: unknown, signature: string): boolean;
     }
     ```
   - `shopify-adapter.ts` — Shopify REST/GraphQL API: pull orders, map to CreateOrderInput
   - `amazon-adapter.ts` — Amazon SP-API: pull orders, handle FBA/FBM
   - `flipkart-adapter.ts` — Flipkart Seller API
   - `meesho-adapter.ts` — Meesho Supplier API

2. **`apps/worker/src/workers/channel-sync-worker.ts`** — Scheduled sync:
   - Runs every 5 minutes per active channel
   - Pulls new orders, deduplicates by channelOrderId, creates via same order pipeline
   - Updates channel order status when DropFlow status changes

---

#### Agent C4: Channel Management UI (parallel after A4)

1. **`apps/web/src/app/(dashboard)/settings/channels/page.tsx`** — Channel list
2. **`apps/web/src/app/(dashboard)/settings/channels/connect/page.tsx`** — OAuth/API key connection flow
3. **`apps/web/src/components/channels/channel-card.tsx`** — Status card per channel (connected/syncing/error)
4. Add channel badge on order list/detail pages showing source

---

### Feature 2.2: Smart Shipping Rate Optimizer

**Value:** Auto-compare 10+ carriers, pick cheapest/fastest per pin code

#### Agent A5: Shipping Service (parallel, no schema dependency)

1. **`apps/worker/src/shipping/`** — New folder:
   - `rate-engine.ts` — Aggregates rates from all carriers:
     ```typescript
     async function getBestRate(params: {
       originPin: string;
       destPin: string;
       weightGrams: number;
       dimensions: Dimensions;
       isInternational: boolean;
       preferSpeed: boolean;
     }): Promise<RateComparison[]>
     ```
   - `carriers/shiprocket.ts` — Shiprocket API client (rate check, create order, track)
   - `carriers/delhivery.ts` — Delhivery API client
   - `carriers/easypost.ts` — EasyPost multi-carrier API (DHL/FedEx/UPS)
   - `serviceability.ts` — Pin code serviceability cache (which carriers serve which pins)

2. **`apps/worker/src/dag/steps/create-shipment.ts`** — Replace SELF carrier:
   - Call rate engine → pick best → create shipment via carrier API → store AWB + label URL

---

#### Agent B5: Shipping UI (parallel)

1. **`apps/web/src/app/(dashboard)/shipments/page.tsx`** — Enhance:
   - Show carrier logo, AWB link, tracking URL, rate paid
   - Add "Rate comparison" expandable showing what other carriers would have cost
2. **`apps/web/src/components/shipping/rate-comparison.tsx`** — Side-by-side rate display
3. **`apps/web/src/components/shipping/tracking-timeline.tsx`** — Visual tracking events

---

### Feature 2.3: COD Risk Intelligence

**Value:** Reduce RTOs by 30-50% → save 5-15% of revenue

#### Agent A6: Risk Scoring Engine (standalone)

1. **`packages/db/prisma/schema.prisma`** — Add to Order model:
```prisma
  paymentMethod     String?    // "PREPAID" | "COD"
  codRiskScore      Float?     // 0.0 - 1.0
  codVerified       Boolean    @default(false)
  rtoReason         String?
```

2. **`packages/db/prisma/schema.prisma`** — New model:
```prisma
model PinCodeStats {
  id              String @id @default(cuid())
  tenantId        String
  pinCode         String
  totalOrders     Int    @default(0)
  deliveredOrders Int    @default(0)
  rtoOrders       Int    @default(0)
  rtoRate         Float  @default(0)
  avgDeliveryDays Float  @default(0)
  lastUpdated     DateTime @default(now())

  @@unique([tenantId, pinCode])
  @@index([tenantId])
  @@map("pin_code_stats")
}
```

3. **`apps/worker/src/risk/`** — New folder:
   - `cod-scorer.ts` — Risk scoring function:
     - Input: buyer phone, shipping pin, order value, first-time buyer?, time of day
     - Factors: pin code RTO history, order value outlier, phone number age, address completeness
     - Output: 0.0 - 1.0 risk score + recommended action (ALLOW / VERIFY / BLOCK)
   - `verification.ts` — WhatsApp/IVR verification for medium-risk COD orders

4. **`apps/worker/src/dag/steps/validate-cod.ts`** — New workflow step:
   - After validate-stock, before route-to-supplier
   - If COD + risk > 0.7 → pause workflow, send WhatsApp verification
   - If COD + risk > 0.9 → auto-convert to prepaid or reject

---

## Phase 3: Moat & Retention Features (Sprint 5-6)

### Feature 3.1: Supplier Collaboration Portal

#### 5 Parallel Agents:

| Agent | Task | Files |
|-------|------|-------|
| **A7** | Schema: SupplierUser model, SupplierInvite, PO comments | `schema.prisma`, `packages/types/src/supplier-portal.ts` |
| **B7** | API: Supplier auth (magic link), PO endpoints, invoice upload | `api/v1/supplier-portal/auth/route.ts`, `api/v1/supplier-portal/pos/route.ts`, `api/v1/supplier-portal/invoices/route.ts` |
| **C7** | UI: Separate `/supplier` layout + pages | `app/(supplier-portal)/layout.tsx`, `app/(supplier-portal)/dashboard/page.tsx`, `app/(supplier-portal)/orders/page.tsx` |
| **D7** | Worker: PO notification to supplier, reminder cron | `workers/supplier-notify-worker.ts` |
| **E7** | Tests: E2E supplier login + PO ack flow | `e2e/supplier-portal.spec.ts` |

---

### Feature 3.2: Branded Self-Serve Returns Portal

#### 4 Parallel Agents:

| Agent | Task | Files |
|-------|------|-------|
| **A8** | Schema: ReturnRequest, ReturnReason enum, reverse shipment | `schema.prisma`, `packages/types/src/returns.ts` |
| **B8** | API: Public returns endpoints (no auth, order# + email verify) | `api/v1/returns/route.ts`, `api/v1/returns/[id]/route.ts` |
| **C8** | UI: Public-facing `app/(returns)/[tenant]/page.tsx` with QR scan, reason select, tracking | 4-5 page components |
| **D8** | Worker: Return pickup scheduling, refund trigger, inventory restock | `workers/returns-worker.ts` |

---

### Feature 3.3: GST Auto-Filing Pipeline

#### 3 Parallel Agents:

| Agent | Task | Files |
|-------|------|-------|
| **A9** | GST Package: GSTR-1/3B JSON generators, GSTR-2A reconciliation | `packages/gst/src/gstr1.ts`, `packages/gst/src/gstr3b.ts`, `packages/gst/src/reconcile.ts` |
| **B9** | API: Filing dashboard, preview, download JSON, submit to GSP | `api/v1/gst/returns/route.ts`, `api/v1/gst/reconcile/route.ts` |
| **C9** | UI: GST filing page with month picker, invoice summary, mismatches table, file button | `app/(dashboard)/finance/gst/page.tsx` |

---

## Phase 4: Fintech Layer (Sprint 7-8)

### Feature 4.1: Instant COD Settlement (T+1)

| Agent | Task |
|-------|------|
| **A10** | Schema: `CodAdvance` model (advance amount, fee, settled date, carrier remittance) |
| **B10** | Worker: Daily cron → identify delivered COD orders → compute advance → create ledger entry |
| **C10** | UI: Finance page "COD Advances" tab, pending/settled, total fees saved |

### Feature 4.2: Invoice Factoring

| Agent | Task |
|-------|------|
| **A11** | Schema: `FactoringRequest` model (invoice, advance %, fee, status, NBFC partner) |
| **B11** | API: Request factoring on eligible invoices, NBFC webhook for disbursement |
| **C11** | UI: Invoice detail → "Get paid early" button, factoring dashboard |

### Feature 4.3: Dynamic Pricing Engine

| Agent | Task |
|-------|------|
| **A12** | Schema: `PricingRule` model (product, min/max margin, competitor URL, strategy) |
| **B12** | Worker: Scheduled scraper → competitor prices → apply rules → update sellingPricePaise |
| **C12** | UI: Pricing rules editor, price change log, margin impact preview |

---

## Execution Matrix — All Agents at a Glance

```
PHASE 1 (Sprint 1-2):                              PHASE 2 (Sprint 3-4):
┌─────────────────────────────────────────┐         ┌──────────────────────────────────────────┐
│ Feature 1.1: Unit Economics             │         │ Feature 2.1: Multi-Channel               │
│   A1 Schema ──┬── B1 API               │         │   A4 Schema ──┬── B4 Workers              │
│               ├── C1 UI                 │         │               └── C4 UI                   │
│               └── D1 Worker             │         │                                           │
│                                         │         │ Feature 2.2: Shipping Optimizer           │
│ Feature 1.2: Workflow Builder           │         │   A5 Service (standalone)                 │
│   A2 Types ───┬── B2 API               │         │   B5 UI                                   │
│               └── C2 UI                 │         │                                           │
│                                         │         │ Feature 2.3: COD Risk                     │
│ Feature 1.3: Notifications              │         │   A6 Schema+Engine ─── integrated into    │
│   A3 Worker (standalone)                │         │                        existing DAG       │
└─────────────────────────────────────────┘         └──────────────────────────────────────────┘

PHASE 3 (Sprint 5-6):                              PHASE 4 (Sprint 7-8):
┌─────────────────────────────────────────┐         ┌──────────────────────────────────────────┐
│ Feature 3.1: Supplier Portal            │         │ Feature 4.1: COD Settlement              │
│   A7─B7─C7─D7─E7 (5 agents parallel)   │         │   A10─B10─C10                            │
│                                         │         │                                           │
│ Feature 3.2: Returns Portal             │         │ Feature 4.2: Invoice Factoring            │
│   A8─B8─C8─D8 (4 agents parallel)      │         │   A11─B11─C11                            │
│                                         │         │                                           │
│ Feature 3.3: GST Auto-Filing            │         │ Feature 4.3: Dynamic Pricing              │
│   A9─B9─C9 (3 agents parallel)         │         │   A12─B12─C12                            │
└─────────────────────────────────────────┘         └──────────────────────────────────────────┘
```

## Parallel Execution per Sprint

### Sprint 1 — Run These Agents Simultaneously:

```
Agent A1 (Schema)  ═══╗
                      ║ wait
Agent A2 (Types)   ═══╬═══► Agent B1 (API) ║ Agent C1 (UI) ║ Agent D1 (Worker)
                      ║     Agent B2 (API) ║ Agent C2 (UI)
Agent A3 (Worker)  ═══╝     Agent A3 continues (no schema dep)
```

**Total: 8 parallel agent slots across 2 waves**

### Sprint 2 — Integration + Tests:
```
Agent T1: Wire analytics into dashboard layout + nav
Agent T2: Wire workflow builder into settings
Agent T3: Wire notifications into DAG steps
Agent T4: E2E tests for all 3 features
```

**Total: 4 parallel agents**

---

## New Package Dependencies

| Package | App | Purpose |
|---------|-----|---------|
| `@tremor/react` | web | KPI cards, area charts, bar charts |
| `recharts` | web | Chart primitives (Tremor peer dep) |
| `@xyflow/react` | web | React Flow for workflow DAG editor |
| `resend` | worker | Transactional email delivery |
| `twilio` | worker | WhatsApp Business API |
| `@shiprocket/api` | worker | Shiprocket shipping integration |
| `easypost` | worker | International shipping (DHL/FedEx/UPS) |

## New shadcn/ui Components Needed

```bash
npx shadcn@latest add tabs sheet separator tooltip dropdown-menu
npx shadcn@latest add switch slider progress avatar
npx shadcn@latest add command popover calendar
npx shadcn@latest add accordion alert-dialog scroll-area
```

## Database Migrations Required

| Migration | Models Added/Modified | Phase |
|-----------|----------------------|-------|
| `001_analytics` | `SkuEconomics`, `DailyRevenue` | 1 |
| `002_channels` | `SalesChannel`, Order.channelSource/channelOrderId | 2 |
| `003_cod_risk` | `PinCodeStats`, Order.codRiskScore/paymentMethod | 2 |
| `004_supplier_portal` | `SupplierUser`, `SupplierInvite`, `POComment` | 3 |
| `005_returns` | `ReturnRequest`, `ReturnReason`, reverse shipment fields | 3 |
| `006_fintech` | `CodAdvance`, `FactoringRequest`, `PricingRule` | 4 |

---

## File Count Summary

| Category | New Files | Modified Files |
|----------|-----------|----------------|
| Prisma Schema | 1 (6 migrations) | — |
| API Routes | ~18 new route.ts | 2 modified |
| Dashboard Pages | ~12 new page.tsx | 3 modified |
| Components | ~25 new | 1 modified (layout) |
| Worker Files | ~15 new | 4 modified |
| Package Types | ~5 new .ts | 3 modified |
| Package Config | — | 2 modified |
| Tests | ~8 new | 1 modified |
| **Total** | **~85 new** | **~16 modified** |

---

## How to Execute with Cursor Agents

To run Phase 1, invoke parallel agents like this:

```
Message: "Implement Phase 1 features"

Agent 1 (Schema):     Runs schema migration + types for all Phase 1 features
Agent 2 (API):        Creates all Phase 1 API routes (after schema)
Agent 3 (UI):         Creates all Phase 1 UI pages + components (after schema)
Agent 4 (Worker):     Creates worker jobs for analytics + notifications (after schema)
Agent 5 (Tests):      Writes E2E tests for Phase 1 (after API + UI)
```

Each subsequent phase follows the same pattern. Phases are sequential
(Phase 2 depends on Phase 1 being merged), but agents within each phase
run in parallel.
