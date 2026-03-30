---
name: growthbook-flags
description: >-
  GrowthBook feature flags for DropFlow tenant-level feature control. Use when
  implementing feature gates, gradual rollouts, or A/B tests scoped per tenant.
---

# GrowthBook Feature Flags — DropFlow

Package: `@growthbook/growthbook-react`

## Installation

```bash
pnpm add @growthbook/growthbook-react --filter web
```

## Provider Setup

File: `apps/web/app/providers.tsx`

```typescript
import { GrowthBook, GrowthBookProvider } from "@growthbook/growthbook-react";

const gb = new GrowthBook({
  apiHost: env.NEXT_PUBLIC_GROWTHBOOK_API_HOST,
  clientKey: env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY,
  enableDevMode: env.NEXT_PUBLIC_APP_ENV === "development",
});

export function Providers({ children, tenantId, tenantPlan }: {
  children: React.ReactNode;
  tenantId: string;
  tenantPlan: string;
}) {
  useEffect(() => {
    gb.setAttributes({
      tenantId,
      plan: tenantPlan,
    });
    gb.init({ streaming: true });
  }, [tenantId, tenantPlan]);

  return (
    <GrowthBookProvider growthbook={gb}>
      {children}
    </GrowthBookProvider>
  );
}
```

## Using Feature Flags in Components

```typescript
"use client";

import { useFeatureIsOn, useFeatureValue } from "@growthbook/growthbook-react";

function OrdersPage() {
  const showBulkActions = useFeatureIsOn("bulk-order-actions");
  const maxExportRows = useFeatureValue("max-export-rows", 1000);

  return (
    <div>
      {showBulkActions && <BulkActionBar />}
      <OrdersTable maxExport={maxExportRows} />
    </div>
  );
}
```

## Server-Side Feature Flags

```typescript
import { GrowthBook } from "@growthbook/growthbook";

export async function getFeatureFlag(tenantId: string, flag: string): Promise<boolean> {
  const gb = new GrowthBook({
    apiHost: env.GROWTHBOOK_API_HOST,
    clientKey: env.GROWTHBOOK_SERVER_KEY,
  });

  gb.setAttributes({ tenantId });
  await gb.init();
  const value = gb.isOn(flag);
  gb.destroy();
  return value;
}
```

## DropFlow Feature Flags

| Flag | Type | Description |
|------|------|-------------|
| `bulk-order-actions` | boolean | Enable bulk select/cancel on orders table |
| `international-shipping` | boolean | Show international carrier options |
| `e-invoice-irp` | boolean | Enable e-Invoice IRP submission |
| `workflow-builder-ui` | boolean | Show visual workflow DAG editor |
| `supplier-portal` | boolean | Enable supplier self-service portal |
| `max-export-rows` | number | Max rows in CSV export |
| `advanced-analytics` | boolean | Show Tremor analytics dashboard |

## Targeting by Tenant Plan

In GrowthBook dashboard, create targeting rules:

- `plan = "STARTER"` → basic features only
- `plan = "GROWTH"` → bulk actions, analytics
- `plan = "ENTERPRISE"` → all features, workflow builder

## Simple DB-Backed Fallback

If GrowthBook is overkill initially, use tenant `workflowConfigJson`:

```typescript
export function isTenantFeatureEnabled(tenant: Tenant, feature: string): boolean {
  const config = tenant.workflowConfigJson as Record<string, unknown>;
  return config[`feature_${feature}`] === true;
}
```

## Conventions

- Feature flag names: kebab-case (e.g., `bulk-order-actions`)
- Always provide a sensible default value (second arg to `useFeatureValue`)
- Evaluate flags server-side for API routes, client-side for UI
- GrowthBook SDK is 9KB — zero network requests for evaluation after init
- Self-host GrowthBook via Docker for full data ownership
