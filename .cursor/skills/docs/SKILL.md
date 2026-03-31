---
name: docs
description: >-
  Keep project documentation in sync with code changes. Use when adding,
  modifying, or removing any feature, API endpoint, database model, workflow
  step, environment variable, or deployment config. Also use when the user
  asks to update docs, generate docs, or mentions documentation.
---

# DropFlow Documentation Skill

## Golden Rule

**Every code change that touches a public contract MUST update the corresponding doc.**

Public contracts include: API routes, Prisma models/enums, env vars, workflow DAG
steps, package exports, CLI scripts, deployment config.

## Doc Location

All docs live in `docs/` at the monorepo root.

| File | Covers |
|------|--------|
| `docs/README.md` | Project overview, quickstart, monorepo layout |
| `docs/architecture.md` | System architecture, tech stack, design decisions |
| `docs/api-reference.md` | Every API endpoint: method, path, request/response, auth |
| `docs/data-model.md` | Prisma schema: models, enums, relations, indexes |
| `docs/deployment.md` | Vercel, Fly.io, Neon setup, env vars, CI/CD |
| `docs/workflows.md` | DAG engine, step handlers, SSE events, BullMQ queues |
| `docs/testing.md` | Vitest, Playwright, E2E strategy, test bypass |

## When to Update Docs

### After adding/changing an API route

1. Open `docs/api-reference.md`
2. Add or update the endpoint entry with: method, path, auth, request body schema, response shape, error codes
3. If the route touches a new model, also update `docs/data-model.md`

### After modifying Prisma schema

1. Open `docs/data-model.md`
2. Update the model table, add new fields/enums
3. Note any migration steps if schema changed destructively

### After adding a workflow step

1. Open `docs/workflows.md`
2. Add the step to the DAG diagram and step handler table
3. Document the step's inputs, outputs, and side effects

### After changing env vars

1. Open `docs/deployment.md`
2. Add or update the env var in the table with: name, required/optional, description, example

### After changing deployment config

1. Open `docs/deployment.md`
2. Update the relevant section (Vercel, Fly.io, or Neon)

### After adding/changing a package export

1. Open `docs/architecture.md`
2. Update the package table if exports changed significantly

### After adding/changing a UI page

1. Open `docs/README.md`
2. Update the feature list or page inventory if user-facing routes changed

## Doc Format Conventions

- Use markdown tables for structured data (endpoints, env vars, models)
- Use mermaid diagrams for architecture and data flow (fenced with ```mermaid)
- Use `inline code` for paths, env vars, field names
- Keep each doc self-contained — no cross-doc dependencies
- Date-stamp significant changes at the bottom of each doc under `## Changelog`

## Sync Verification Checklist

Before finishing any feature PR, verify:

- [ ] New API endpoints documented in `docs/api-reference.md`
- [ ] New/changed models documented in `docs/data-model.md`
- [ ] New env vars documented in `docs/deployment.md`
- [ ] New workflow steps documented in `docs/workflows.md`
- [ ] New packages/exports documented in `docs/architecture.md`
- [ ] Feature described in `docs/README.md` if user-facing
