---
name: prisma-multi-tenant
description: >-
  Prisma multi-tenant patterns for DropFlow with Neon PostgreSQL. Use when
  working with the database, creating queries, adding models, running
  migrations, or implementing tenant isolation.
---

# Prisma Multi-Tenant — DropFlow

Package: `prisma`, `@prisma/client`  
Location: `packages/db/`

## Tenant Isolation (lib/tenant-prisma.ts)

Every DB table has `tenantId`. This middleware enforces it on every query:

```typescript
import { PrismaClient, Prisma } from "@dropflow/db";

const globalPrisma = new PrismaClient();

export function getTenantPrisma(tenantId: string) {
  return globalPrisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findUnique({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
    },
  });
}
```

## Neon Connection Config

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")         // Neon pooled (Vercel serverless)
  directUrl = env("DIRECT_DATABASE_URL")  // Neon direct (Fly.io + migrations)
}
```

- **Vercel (web):** Use pooled URL (`*.pooler.neon.tech`) — handles serverless connection limits
- **Fly.io (worker):** Use direct URL — persistent connection for long-running workers
- **Migrations:** Always use direct URL: `pnpm prisma migrate dev`

## ID Convention

All IDs are cuid2 strings:

```prisma
model Order {
  id       String @id @default(cuid())
  tenantId String
  // ...
}
```

Use `@paralleldrive/cuid2` for generating IDs in code:

```typescript
import { createId } from "@paralleldrive/cuid2";
const id = createId();
```

## Migration Commands

```bash
# Create migration (dev)
pnpm --filter db prisma migrate dev --name add-tracking-events

# Apply migrations (prod)
pnpm --filter db prisma migrate deploy

# Generate client after schema change
pnpm --filter db prisma generate

# Browse data
pnpm --filter db prisma studio
```

## Query Patterns

Always query through `getTenantPrisma()` — never use raw PrismaClient:

```typescript
const db = getTenantPrisma(tenantId);

// Paginated list
const [items, total] = await Promise.all([
  db.order.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { items: true },
  }),
  db.order.count({ where: { status: "PENDING" } }),
]);
```

## Model Conventions

- Prisma model: `PascalCase` singular (e.g., `Order`)
- DB table: `snake_case` plural via `@@map("orders")`
- Every model has `tenantId String` (except `Tenant` itself)
- Money fields: always `Int` in paise (never Float/Decimal)
- JSON fields: typed as `Json` in Prisma, validated with Zod at runtime

## Neon Branch Workflow

```bash
# Create branch for feature
neon branches create --name feature/my-feature --parent main

# Set DATABASE_URL to branch connection string in Vercel preview
# Run migrations on branch
pnpm prisma migrate deploy

# On PR merge → delete branch
neon branches delete feature/my-feature
```
