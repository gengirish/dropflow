---
name: fast-csv-import
description: >-
  fast-csv for bulk product CSV import in DropFlow. Use when implementing the
  bulk import API route, CSV parsing, validation, or error reporting for the
  catalog product import feature.
---

# fast-csv — Bulk Product Import

Package: `@fast-csv/parse`  
Location: `apps/web/actions/catalog/bulk-import-products.ts`

## Installation

```bash
pnpm add @fast-csv/parse --filter web
```

## CSV Format (Expected)

```csv
sku,name,description,hsnCode,costPricePaise,sellingPricePaise,gstRatePercent,stockQty,lowStockThreshold,supplierId
TSHIRT-BLK-M,Black T-Shirt Medium,,6109,45000,89900,5,100,10,clx_supplier_1
TSHIRT-BLK-L,Black T-Shirt Large,,6109,45000,89900,5,80,10,clx_supplier_1
```

## Stream-Based Parser

```typescript
import { parse } from "@fast-csv/parse";
import { Readable } from "stream";
import { z } from "zod";

const ProductRow = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  hsnCode: z.string().min(4),
  costPricePaise: z.coerce.number().int().positive(),
  sellingPricePaise: z.coerce.number().int().positive(),
  gstRatePercent: z.coerce.number().int().refine(v => [0, 5, 12, 18, 28].includes(v)),
  stockQty: z.coerce.number().int().nonnegative().default(0),
  lowStockThreshold: z.coerce.number().int().nonnegative().default(10),
  supplierId: z.string().min(1),
});

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; sku: string; message: string }[];
}

export async function parseAndImportCSV(
  csvBuffer: Buffer,
  tenantId: string,
  db: ReturnType<typeof getTenantPrisma>,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  let rowNum = 0;

  return new Promise((resolve, reject) => {
    const stream = Readable.from(csvBuffer);

    stream
      .pipe(parse({ headers: true, trim: true, skipLines: 0 }))
      .on("data", async (row) => {
        rowNum++;
        const parsed = ProductRow.safeParse(row);

        if (!parsed.success) {
          result.errors.push({
            row: rowNum,
            sku: row.sku ?? "unknown",
            message: parsed.error.issues.map(i => `${i.path}: ${i.message}`).join("; "),
          });
          result.skipped++;
          return;
        }

        try {
          const data = parsed.data;
          const marginPercent = ((data.sellingPricePaise - data.costPricePaise) / data.sellingPricePaise) * 100;

          await db.product.upsert({
            where: { tenantId_sku: { tenantId, sku: data.sku } },
            create: {
              tenantId,
              ...data,
              marginPercent,
              isActive: true,
              isListed: true,
            },
            update: {
              ...data,
              marginPercent,
            },
          });
          result.imported++;
        } catch (err) {
          result.errors.push({
            row: rowNum,
            sku: parsed.data.sku,
            message: err instanceof Error ? err.message : "Database error",
          });
          result.skipped++;
        }
      })
      .on("end", () => resolve(result))
      .on("error", reject);
  });
}
```

## API Route (app/api/v1/catalog/products/bulk-import/route.ts)

```typescript
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireAuth(req);
    const db = getTenantPrisma(tenantId);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return err("NO_FILE", "CSV file is required", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseAndImportCSV(buffer, tenantId, db);

    return ok(result, result.errors.length > 0 ? 207 : 200);
  } catch (error) {
    return err("IMPORT_ERROR", "Failed to import products", 500);
  }
}
```

## Conventions

- Stream-based parsing — never load entire CSV into memory
- Validate every row with Zod before inserting
- Use upsert on `(tenantId, sku)` composite unique — allows re-imports
- Return detailed error report: row number, SKU, error message
- All prices in CSV are paise (integer) — document this in import UI
- Margin percent is computed, never user-supplied
- Limit file size in middleware (e.g., 10MB max)
