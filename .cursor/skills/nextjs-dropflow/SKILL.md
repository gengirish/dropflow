---
name: nextjs-dropflow
description: >-
  Next.js 14 App Router patterns for DropFlow. Use when creating routes,
  layouts, API handlers, middleware, or working with the App Router in
  apps/web/.
---

# Next.js 14 — DropFlow Patterns

## Route Groups

```
app/
├── (auth)/              # Clerk sign-in/sign-up
├── (dashboard)/         # Seller dashboard (tenant-scoped)
│   ├── layout.tsx       # Auth guard + tenant resolver
│   ├── orders/
│   ├── catalog/
│   ├── shipments/
│   ├── finance/
│   └── settings/
├── (storefront)/        # Buyer-facing (tenant subdomain)
├── (supplier)/          # Supplier portal
└── api/v1/              # REST API routes
```

## API Route Pattern

All API routes at `app/api/v1/[resource]/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { ok, err, paginated } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { CreateOrderInput } from "@dropflow/types";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireAuth(req);
    const body = CreateOrderInput.parse(await req.json());
    const db = getTenantPrisma(tenantId);

    const order = await db.order.create({ data: { ...body, tenantId } });
    return ok(order, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err("VALIDATION_ERROR", error.message, 422);
    }
    return err("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
```

## Server Action Pattern

File: `actions/[domain]/[verb]-[noun].ts`

```typescript
"use server";

import { authAction } from "@/lib/safe-action";
import { CreateOrderInput } from "@dropflow/types";

export const createOrder = authAction
  .schema(CreateOrderInput)
  .action(async ({ parsedInput, ctx }) => {
    const db = ctx.tenantPrisma;
    // ... business logic
    return { order };
  });
```

## Middleware (middleware.ts)

Runs on all `/api/v1/*` and `/(dashboard)/*` routes:

```typescript
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware((auth, req) => {
  // 1. Resolve subdomain → tenantId
  // 2. Rate limit: 100 req/min per tenantId
  // 3. Attach tenantId to request headers
  const headers = new Headers(req.headers);
  headers.set("x-tenant-id", tenantId);
  return NextResponse.next({ headers });
});

export const config = {
  matcher: ["/api/v1/(.*)", "/(dashboard)/(.*)"],
};
```

## Response Helpers (lib/api-response.ts)

Every API response follows this shape:

```typescript
{ success: boolean, data?: T, error?: { code: string, message: string } }
```

Paginated responses:

```typescript
{ items: T[], total: number, page: number, pageSize: number, hasMore: boolean }
```

## Environment Variables

Always parsed via `lib/env.ts` using Zod — never use `process.env` directly in business logic.

## File Naming Conventions

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utils/libs: `camelCase.ts`
- Server actions: `verb-noun.ts` (e.g., `create-order.ts`)
- API routes: `app/api/v1/[resource]/route.ts`
