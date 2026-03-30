---
name: biome-dx
description: >-
  Biome linting/formatting + tsx runner for DropFlow developer experience.
  Use when configuring linting, formatting, running TypeScript scripts, or
  setting up DX tooling.
---

# Biome + tsx — DropFlow DX

Packages: `@biomejs/biome`, `tsx`

## Biome Setup

```bash
pnpm add -D @biomejs/biome -w   # root workspace
npx @biomejs/biome init          # creates biome.json
```

## biome.json (workspace root)

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExcessiveCognitiveComplexity": { "level": "warn", "options": { "maxAllowedComplexity": 15 } }
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noImplicitAnyLet": "error"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      ".next",
      "*.generated.ts",
      "packages/db/prisma/migrations"
    ]
  }
}
```

## Commands

```bash
# Check all files
npx biome check .

# Fix auto-fixable issues
npx biome check --write .

# Format only
npx biome format --write .

# Lint only
npx biome lint .

# CI mode (exits with error code)
npx biome ci .
```

## package.json Scripts (root)

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  }
}
```

## turbo.json Integration

```json
{
  "pipeline": {
    "lint": {
      "outputs": []
    }
  }
}
```

## tsx — TypeScript Script Runner

Use `tsx` to run TypeScript files directly without compilation:

```bash
pnpm add -D tsx -w
```

Use cases:
- Database seed scripts
- One-off data migrations
- Local dev utilities

```bash
# Run a seed script
npx tsx packages/db/src/seed.ts

# Run a migration utility
npx tsx scripts/backfill-order-numbers.ts
```

## Seed Script Pattern

```typescript
// packages/db/src/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      clerkOrgId: "org_demo",
      slug: "demo",
      name: "Demo Store",
      plan: "GROWTH",
      sellerStateCode: "29",
    },
  });
  console.log("Seed complete");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Conventions

- Biome replaces ESLint + Prettier — do not install both
- `noExplicitAny: "error"` enforces TypeScript strict mode at lint level
- Run `biome ci .` in CI pipeline — fails on any lint/format issue
- Use `tsx` instead of `ts-node` — faster, ESM-compatible, zero config
- Add `biome check --write` to pre-commit hook (via husky/lint-staged or lefthook)
