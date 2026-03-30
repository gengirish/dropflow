---
name: tremor-analytics
description: >-
  Tremor dashboard chart and KPI components for DropFlow analytics. Use when
  building analytics dashboards, order metrics, revenue charts, or inventory
  KPI cards in the finance or dashboard pages.
---

# Tremor Analytics — DropFlow Dashboard

Package: `@tremor/react`

## Installation

```bash
pnpm add @tremor/react --filter web
```

## KPI Cards Row

```typescript
import { Card, Metric, Text, Flex, BadgeDelta } from "@tremor/react";

const kpis = [
  { title: "Total Orders", value: 1243, delta: "+12.3%", type: "increase" },
  { title: "Revenue", value: "₹24,56,789", delta: "+8.1%", type: "increase" },
  { title: "Avg Order Value", value: "₹1,976", delta: "-2.4%", type: "decrease" },
  { title: "Pending Shipments", value: 47, delta: "0%", type: "unchanged" },
];

export function KPICards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <Text>{kpi.title}</Text>
          <Flex className="items-end space-x-2">
            <Metric>{kpi.value}</Metric>
            <BadgeDelta deltaType={kpi.type}>{kpi.delta}</BadgeDelta>
          </Flex>
        </Card>
      ))}
    </div>
  );
}
```

## Revenue Chart (Area)

```typescript
import { AreaChart, Card, Title } from "@tremor/react";

const revenueFormatter = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact" })
    .format(v / 100); // paise → rupees

export function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  return (
    <Card>
      <Title>Revenue (Last 30 Days)</Title>
      <AreaChart
        data={data}
        index="date"
        categories={["revenue"]}
        valueFormatter={revenueFormatter}
        showLegend={false}
        className="mt-4 h-72"
      />
    </Card>
  );
}
```

## Order Status Distribution (Donut)

```typescript
import { DonutChart, Card, Title, Legend } from "@tremor/react";

export function OrderStatusChart({ data }) {
  return (
    <Card>
      <Title>Orders by Status</Title>
      <DonutChart
        data={data}
        category="count"
        index="status"
        className="mt-4 h-52"
      />
      <Legend categories={data.map(d => d.status)} className="mt-3" />
    </Card>
  );
}
```

## Inventory Low-Stock Bar Chart

```typescript
import { BarChart, Card, Title } from "@tremor/react";

export function LowStockChart({ products }) {
  return (
    <Card>
      <Title>Low Stock Products</Title>
      <BarChart
        data={products}
        index="name"
        categories={["stockQty", "lowStockThreshold"]}
        colors={["red", "gray"]}
        className="mt-4 h-72"
      />
    </Card>
  );
}
```

## Conventions

- Always format money values from paise → rupees with `en-IN` locale
- Use `notation: "compact"` for chart axes (₹24.6L instead of ₹24,56,789)
- Tremor components work with Tailwind — no style conflicts with shadcn/ui
- Place analytics components in dashboard layout pages, not in reusable `components/ui/`
