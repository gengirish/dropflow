---
name: next-safe-action
description: >-
  Type-safe server actions with next-safe-action in DropFlow. Use when creating
  or modifying server actions in apps/web/actions/, adding middleware chains,
  or implementing optimistic updates.
---

# next-safe-action — DropFlow Patterns

Package: `next-safe-action` (v8+)

## Setup (lib/safe-action.ts)

```typescript
import { createSafeActionClient } from "next-safe-action";
import { getAuthTenant } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";

export const action = createSafeActionClient({
  handleServerError(e) {
    return e.message;
  },
});

export const authAction = action.use(async ({ next }) => {
  const { userId, tenantId } = await getAuthTenant();
  if (!userId) throw new Error("Unauthorized");

  const tenantPrisma = getTenantPrisma(tenantId);
  return next({ ctx: { userId, tenantId, tenantPrisma } });
});

export const adminAction = authAction.use(async ({ next, ctx }) => {
  const { role } = await requireRole(ctx.userId, "ADMIN");
  return next({ ctx: { ...ctx, role } });
});
```

## Creating a Server Action

File: `actions/orders/create-order.ts`

```typescript
"use server";

import { authAction } from "@/lib/safe-action";
import { CreateOrderInput } from "@dropflow/types";
import { revalidatePath } from "next/cache";

export const createOrder = authAction
  .schema(CreateOrderInput)
  .action(async ({ parsedInput, ctx }) => {
    const order = await ctx.tenantPrisma.order.create({
      data: {
        ...parsedInput,
        tenantId: ctx.tenantId,
        orderNumber: await generateOrderNumber(ctx.tenantId),
      },
    });

    revalidatePath("/orders");
    return { order };
  });
```

## Client Usage

```typescript
"use client";

import { useAction } from "next-safe-action/hooks";
import { createOrder } from "@/actions/orders/create-order";

function CreateOrderForm() {
  const { execute, result, isExecuting } = useAction(createOrder);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      execute({ buyerName: "...", items: [...] });
    }}>
      {result.serverError && <p>{result.serverError}</p>}
      {result.validationErrors && <p>Check form fields</p>}
      <button disabled={isExecuting}>Create Order</button>
    </form>
  );
}
```

## Optimistic Updates

```typescript
const { execute, optimisticState } = useOptimisticAction(updateOrderStatus, {
  currentState: order,
  updateFn: (state, input) => ({
    ...state,
    status: input.status,
  }),
});
```

## Conventions

- Every action file starts with `"use server"`
- Always use `authAction` base (never raw `action`) for tenant-scoped operations
- Use `adminAction` for settings, workflow config, tenant management
- Schema is always a Zod schema from `@dropflow/types`
- Call `revalidatePath()` after mutations that affect displayed data
- File path: `actions/[domain]/[verb]-[noun].ts`
