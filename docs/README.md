# DropFlow — Documentation

## What is DropFlow

DropFlow is a multi-tenant Workflow-as-a-Service (WaaS) platform built for Indian D2C and dropshipping brands. It automates the full order-to-fulfillment pipeline—routing orders to suppliers, purchase orders, and shipments—with real-time workflow visualization, GST-compliant invoicing, and Razorpay payments.

## Features (current)

- Catalog management (products, suppliers, inventory)
- Order lifecycle management with real-time DAG workflow
- GST invoice generation (CGST+SGST intra-state, IGST inter-state)
- Razorpay payment integration
- Multi-tenant architecture with Clerk auth
- Real-time SSE workflow updates
- Shipment tracking
- Finance dashboard

## Monorepo Layout

```
dropflow/
├── apps/
│   ├── web/          # Next.js 14 App Router (Vercel)
│   └── worker/       # Express + BullMQ + DAG engine (Fly.io)
├── packages/
│   ├── db/           # Prisma ORM + Neon PostgreSQL
│   ├── config/       # Shared enums, constants, carriers
│   ├── gst/          # Indian GST calculation engine
│   └── types/        # Zod schemas for API validation
├── e2e/              # Playwright E2E tests
├── scripts/          # Build & deploy scripts
└── docs/             # Project documentation
```

## Quickstart

Prerequisites: Node.js 20+, pnpm 9+

```bash
pnpm install
# Set up .env files (see docs/deployment.md)
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000
- Worker: http://localhost:3001

## Tech Stack

Turborepo, pnpm workspaces, Next.js 14, React 18, Tailwind CSS, shadcn/ui, Prisma 6, Neon PostgreSQL, BullMQ, Redis, Clerk, Razorpay, Zod, Vitest, Playwright, Biome, Vercel, Fly.io.

## Documentation

- [Architecture](architecture.md)
- [API Reference](api-reference.md)
- [Data Model](data-model.md)
- [Deployment](deployment.md)
- [Workflows](workflows.md)
- [Testing](testing.md)

## Changelog

- 2026-03-30: Phase 0-2 complete, E2E passing, deployed to Vercel
