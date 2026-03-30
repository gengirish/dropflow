---
name: tanstack-data-views
description: >-
  TanStack Table + TanStack Query + nuqs patterns for DropFlow data tables.
  Use when building paginated, sortable, filterable tables for orders, products,
  invoices, or shipments in the dashboard.
---

# TanStack Table + Query + nuqs — DropFlow Data Views

Packages: `@tanstack/react-table`, `@tanstack/react-query`, `nuqs`

## Server-Side Table Pattern

### 1. URL State with nuqs

```typescript
"use client";

import { useQueryStates, parseAsString, parseAsInteger } from "nuqs";

export function useOrderFilters() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(20),
    status: parseAsString,
    search: parseAsString,
    sortBy: parseAsString.withDefault("createdAt"),
    sortOrder: parseAsString.withDefault("desc"),
  });
}
```

### 2. Data Fetching with TanStack Query

```typescript
import { useQuery } from "@tanstack/react-query";

export function useOrders(filters: ReturnType<typeof useOrderFilters>[0]) {
  return useQuery({
    queryKey: ["orders", filters],
    queryFn: () => fetch(`/api/v1/orders?${new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
    )}`).then(r => r.json()),
  });
}
```

### 3. Table Column Definitions

```typescript
import { ColumnDef } from "@tanstack/react-table";
import { OrderSummaryDTO } from "@dropflow/types";

export const orderColumns: ColumnDef<OrderSummaryDTO>[] = [
  {
    accessorKey: "orderNumber",
    header: "Order #",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.orderNumber}</span>
    ),
  },
  {
    accessorKey: "buyerName",
    header: "Customer",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "totalPaise",
    header: "Total",
    cell: ({ row }) => <MoneyDisplay paise={row.original.totalPaise} />,
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => <DateDisplay date={row.original.createdAt} />,
  },
];
```

### 4. Table Component

```typescript
"use client";

import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function OrdersTable() {
  const [filters, setFilters] = useOrderFilters();
  const { data, isLoading } = useOrders(filters);

  const table = useReactTable({
    data: data?.items ?? [],
    columns: orderColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil((data?.total ?? 0) / filters.pageSize),
  });

  return (
    <>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(hg => (
            <TableRow key={hg.id}>
              {hg.headers.map(h => (
                <TableHead key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DataTablePagination
        page={filters.page}
        pageSize={filters.pageSize}
        total={data?.total ?? 0}
        onPageChange={(page) => setFilters({ page })}
      />
    </>
  );
}
```

## SSE-Driven Invalidation

```typescript
import { useQueryClient } from "@tanstack/react-query";
import { useSSE } from "@/hooks/useSSE";

function OrdersDashboard() {
  const queryClient = useQueryClient();

  useSSE({
    onEvent: (event) => {
      if (event.type === "ORDER_STATUS") {
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      }
    },
  });

  return <OrdersTable />;
}
```

## Conventions

- All tables use server-side pagination, sorting, filtering (never client-side for large datasets)
- URL state via nuqs — every filter is shareable via URL
- TanStack Query caches results and deduplicates requests
- Invalidate query cache on SSE events for real-time updates
- Use `manualPagination: true` and `manualSorting: true` for server-driven tables
