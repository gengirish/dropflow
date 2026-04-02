---
name: doc-authoring
description: >-
  Create new documentation files and update existing ones in docs/ following
  DropFlow conventions. Use when the user asks to create a doc, write a guide,
  add a new documentation page, update doc sections, restructure docs, or when
  a new feature needs its own standalone document.
---

# DropFlow Doc Authoring

## Scope

This skill covers **creating** new doc files and **structuring updates** to existing ones inside `docs/`. For syncing docs after code changes, see the `docs` skill instead.

## Doc Inventory

| File | Purpose |
|------|---------|
| `docs/README.md` | Project overview, quickstart, monorepo layout, feature list |
| `docs/architecture.md` | System architecture, tech stack, design decisions |
| `docs/api-reference.md` | REST endpoints: method, path, auth, request/response, errors |
| `docs/data-model.md` | Prisma models, enums, relations, ER diagram |
| `docs/deployment.md` | Vercel, Fly.io, Neon setup, env vars, CI/CD |
| `docs/workflows.md` | DAG engine, step handlers, SSE events, BullMQ queues |
| `docs/testing.md` | Vitest, Playwright, E2E strategy |

New documents go in `docs/` at the monorepo root. Register them in `docs/README.md` under the **Documentation** links section.

## Creating a New Document

### 1. Pick the right file

- If the content belongs in an existing file, update that file instead.
- Create a new file only when the topic is large enough to warrant its own page (e.g., a feature guide, integration doc, or runbook).

### 2. File naming

- Lowercase, kebab-case: `docs/bulk-import-guide.md`
- Short, descriptive: prefer `shipping-carriers.md` over `carrier-integration-documentation.md`

### 3. Use the standard template

```markdown
# DropFlow — <Title>

<One-paragraph summary of what this document covers and who it is for.>

## <First Section>

Content here.

## <Next Section>

Content here.

## Changelog

- **YYYY-MM-DD:** Created — <brief reason>.
```

### 4. Register the new doc

Add a link in `docs/README.md` under **Documentation**:

```markdown
- [Title](filename.md)
```

## Formatting Conventions

### Headings

- `# DropFlow — <Title>` for the top-level heading (only one per file).
- `##` for major sections, `###` for subsections. Avoid `####` or deeper.

### Tables

Use markdown tables for structured data (endpoints, env vars, model fields, config options):

```markdown
| Column A | Column B | Column C |
|----------|----------|----------|
| value    | value    | value    |
```

### Diagrams

Use fenced mermaid blocks for architecture, flow, and ER diagrams:

````markdown
```mermaid
flowchart TB
  A --> B
```
````

### Inline references

- Use `inline code` for: file paths, env vars, field names, CLI commands, package names.
- Use **bold** for emphasis, not ALL CAPS.

### Code blocks

- Always include the language tag: ` ```bash `, ` ```json `, ` ```typescript `.
- Keep examples minimal — show the happy path, not every edge case.

### Self-contained pages

Each doc should be readable on its own. Avoid cross-doc `[link](other.md#section)` anchors — prefer duplicating a short summary over forcing the reader to jump between files.

## Updating an Existing Document

### Adding a new section

1. Read the file to find the correct insertion point (maintain logical order).
2. Add the new `##` or `###` section with content.
3. If the section documents a newly supported feature, update the feature list in `docs/README.md`.

### Updating an existing section

1. Read the current content first — never overwrite without reading.
2. Preserve existing structure (heading levels, table columns).
3. If a table gains a new column, update every row.

### Changelog entry

Every meaningful update **must** append a dated entry at the bottom of the file:

```markdown
## Changelog

- **YYYY-MM-DD:** <What changed and why>.
```

If a `## Changelog` section doesn't exist yet, create one at the end of the file.

## API Reference Entry Template

When adding a new endpoint group to `docs/api-reference.md`:

```markdown
## <Domain> — <resource>

| Method | Path | Auth | Query / body | Success response | HTTP | Error codes (status) |
|--------|------|------|--------------|------------------|------|----------------------|
| GET | `/api/v1/<resource>` | Yes | Query: `page`, `pageSize` | `{ success, data: { items, total, page, pageSize, hasMore } }` | 200 | `<RESOURCE>_FETCH_FAILED` (500) |

### `POST /api/v1/<resource>` body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | |
```

## Data Model Entry Template

When adding a new model to `docs/data-model.md`:

1. Add the model to the mermaid ER diagram.
2. Add a `### ModelName` section with a field table:

```markdown
### ModelName

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, `cuid()` | Identifier |
| `tenantId` | String | FK → Tenant.id | Owning tenant |
```

## Workflow Step Entry Template

When adding a workflow step to `docs/workflows.md`:

```markdown
### `step-name`

| Property | Value |
|----------|-------|
| Queue | `<queue-name>` |
| Depends on | `<parent-step>` |
| Inputs | `<what it reads>` |
| Outputs | `<what it writes>` |
| Side effects | `<external calls, emails, etc.>` |
```

## Guide / Runbook Template

For operational guides (e.g., beta testing, migration runbooks):

```markdown
# DropFlow — <Guide Title>

<Audience and purpose.>

## Prerequisites

- Requirement 1
- Requirement 2

## Steps

### 1. <First step>

Instructions.

### 2. <Second step>

Instructions.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| ... | ... | ... |

## Changelog

- **YYYY-MM-DD:** Created.
```

## Pre-Submission Checklist

Before finishing any doc creation or update:

- [ ] Top heading follows `# DropFlow — <Title>` pattern
- [ ] No heading level deeper than `###`
- [ ] Tables are consistently formatted
- [ ] Mermaid diagrams render (no syntax errors)
- [ ] Code blocks have language tags
- [ ] `## Changelog` entry added with today's date
- [ ] New doc registered in `docs/README.md`
- [ ] File uses kebab-case naming
- [ ] Page is self-contained (no mandatory cross-doc links)
