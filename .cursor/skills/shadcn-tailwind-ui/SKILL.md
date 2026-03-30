---
name: shadcn-tailwind-ui
description: >-
  shadcn/ui + Tailwind CSS component patterns for DropFlow dashboard. Use when
  building UI components, forms, dialogs, sheets, or any frontend in apps/web/.
---

# shadcn/ui + Tailwind — DropFlow UI

Packages: `shadcn`, `tailwindcss`, `@radix-ui/*`  
Location: `apps/web/components/`

## Component Directory

```
components/
├── ui/              # shadcn/ui base components (auto-generated)
├── orders/          # Order-specific composed components
├── catalog/         # Product/inventory components
├── shipments/       # Shipping tracking components
└── finance/         # Invoice/payout components
```

## Adding shadcn Components

```bash
# From apps/web/
npx shadcn@latest add button card dialog form input select sheet table toast
```

## Form Pattern (with React Hook Form + Zod)

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateProductInput } from "@dropflow/types";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateProductForm() {
  const form = useForm<CreateProductInput>({
    resolver: zodResolver(CreateProductInput),
    defaultValues: { name: "", sku: "", costPricePaise: 0 },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Create Product
        </Button>
      </form>
    </Form>
  );
}
```

## Money Display Component

Always show Indian lakh formatting with ₹:

```typescript
export function MoneyDisplay({ paise }: { paise: number }) {
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(paise / 100);

  return <span className="font-mono tabular-nums">{formatted}</span>;
}
```

## Status Badge Pattern

```typescript
import { Badge } from "@/components/ui/badge";
import { OrderStatus } from "@dropflow/config";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  PROCESSING: "secondary",
  SHIPPED: "default",
  DELIVERED: "default",
  CANCELLED: "destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>{status}</Badge>;
}
```

## Sheet for Detail View

```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function OrderDetailSheet({ order, open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>Order {order.orderNumber}</SheetTitle>
        </SheetHeader>
        {/* Order detail content */}
      </SheetContent>
    </Sheet>
  );
}
```

## Date Display (Indian Format)

```typescript
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export function DateDisplay({ date }: { date: Date | string }) {
  const ist = toZonedTime(new Date(date), "Asia/Kolkata");
  return <time>{format(ist, "dd/MM/yyyy")}</time>;
}
```

## Conventions

- All colors via Tailwind theme — no hardcoded hex values
- Dark mode: use `dark:` variant classes
- Responsive: mobile-first, use `sm:`, `md:`, `lg:` breakpoints
- Spacing: consistent `space-y-4` for form sections, `gap-4` for grids
- Typography: `text-sm` for table cells, `text-lg font-semibold` for headings
