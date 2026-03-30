---
name: turborepo-pnpm
description: >-
  Turborepo + pnpm workspace patterns for the DropFlow monorepo. Use when
  creating packages, configuring build pipelines, adding workspace dependencies,
  or running monorepo-scoped commands.
---

# Turborepo + pnpm Monorepo

## Workspace Structure

```
dropflow/
├── apps/web/          # Next.js 14 → Vercel
├── apps/worker/       # BullMQ service → Fly.io
├── packages/db/       # Prisma client + schema
├── packages/types/    # Zod schemas + TS types
├── packages/gst/      # GST calculation engine
├── packages/config/   # Shared enums, constants
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## Key Commands

```bash
# Install all deps across workspace
pnpm install

# Add dep to specific workspace
pnpm add zod --filter web
pnpm add bullmq --filter worker
pnpm add -D vitest --filter gst

# Add shared package as workspace dep
pnpm add @dropflow/db --filter web --workspace
pnpm add @dropflow/types --filter worker --workspace

# Run scripts scoped
pnpm --filter web dev
pnpm --filter worker build
pnpm --filter db generate    # prisma generate

# Run across all packages
pnpm -r build
pnpm -r test
```

## turbo.json Pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "db#generate": {
      "cache": false
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

## Package Naming Convention

All shared packages use `@dropflow/` scope in their package.json:

```json
{ "name": "@dropflow/db" }
{ "name": "@dropflow/types" }
{ "name": "@dropflow/gst" }
{ "name": "@dropflow/config" }
```

Apps use plain names: `"name": "web"`, `"name": "worker"`.

## New Package Scaffold

When creating a new shared package:

```bash
mkdir -p packages/new-pkg/src
```

Minimum `packages/new-pkg/package.json`:

```json
{
  "name": "@dropflow/new-pkg",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  }
}
```

Minimum `packages/new-pkg/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## Common Gotchas

- Always use `--filter` to scope installs — never `cd` into a package and run `pnpm add`
- `^build` in dependsOn means "build my workspace dependencies first"
- `cache: false` for `dev` and `db#generate` — these should never be cached
- Use `persistent: true` for long-running dev servers
