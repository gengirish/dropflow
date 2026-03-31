# DropFlow — Deployment

## Infrastructure overview

| Layer | Platform | Notes |
|-------|----------|--------|
| Web | Vercel | Next.js 14 App Router, serverless functions |
| Worker | Fly.io | Docker image: Express, BullMQ, DAG jobs |
| Database | Neon | Serverless PostgreSQL |
| Cache / queue | Redis | Co-located in the worker image (`redis-server` + `REDIS_URL=redis://localhost:6379` in `fly.toml`) or an external URL (e.g. Upstash) via secrets |
| Auth | Clerk | Web app |
| Payments (India) | Razorpay | Web app |

## Environment variables

Values are validated in `apps/web/src/lib/env.ts` (web) and `apps/worker/src/lib/env.ts` (worker). Use the same names in Vercel and `fly secrets set`.

| Variable | App | Required | Description | Example |
|----------|-----|----------|-------------|---------|
| `DATABASE_URL` | both | yes (web & worker) | Neon pooled connection string for runtime queries | `postgresql://...` |
| `DIRECT_DATABASE_URL` | both | no | Neon direct (non-pooled) URL for Prisma migrations and `directUrl` in `schema.prisma` | `postgresql://...` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web | yes | Clerk publishable key | `pk_test_...` |
| `CLERK_SECRET_KEY` | web | yes | Clerk secret | `sk_test_...` |
| `CLERK_WEBHOOK_SECRET` | web | no | Verifies Clerk webhook signatures | `whsec_...` |
| `NEXT_PUBLIC_APP_ENV` | web | yes (set explicitly in production) | `development`, `production`, or `test` | `production` |
| `NEXT_PUBLIC_APP_URL` | web | no | Public site URL (defaults to `http://localhost:3000`) | `https://dropflow-beta.vercel.app` |
| `E2E_TEST_KEY` | web | no | Shared secret for E2E test auth bypass (`middleware` / `auth`) | `dropflow-e2e-...` |
| `FLY_WORKER_URL` | web | no | Worker base URL (e.g. SSE / tRPC to Fly) | `https://dropflow-worker.fly.dev` |
| `WORKER_SECRET` | web | no | Shared secret for web-to-worker requests (min 16 chars when set) | long random string |
| `WORKER_SECRET` | worker | yes | Same value as web when using authenticated worker endpoints | long random string |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | web | no | Razorpay key id for checkout | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | web | no | Razorpay API secret | (server only) |
| `RAZORPAY_WEBHOOK_SECRET` | web | no | Razorpay webhook signing secret | (server only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | web | no | Stripe publishable key (non-IN flows) | `pk_test_...` |
| `STRIPE_SECRET_KEY` | web | no | Stripe secret key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | web | no | Stripe webhook signing secret | `whsec_...` |
| `RESEND_API_KEY` | web | no | Resend API for transactional email | `re_...` |
| `RESEND_API_KEY` | worker | no | Same provider if the worker sends mail | `re_...` |
| `BLOB_READ_WRITE_TOKEN` | web | no | Vercel Blob read/write token | (token) |
| `REDIS_URL` | worker | yes | BullMQ / Redis connection (`fly.toml` defaults to sidecar Redis) | `redis://localhost:6379` |
| `PORT` | worker | no | HTTP port for Express | `3001` |
| `NODE_ENV` | worker | no | Usually `production` on Fly | `production` |
| `LOG_LEVEL` | worker | no | Pino log level | `info` |
| `SHIPROCKET_EMAIL` | worker | no | Shiprocket account email | |
| `SHIPROCKET_PASSWORD` | worker | no | Shiprocket account password | |
| `DELHIVERY_TOKEN` | worker | no | Delhivery API token | |
| `EASYPOST_API_KEY` | worker | no | EasyPost API key | |
| `TWILIO_ACCOUNT_SID` | worker | no | Twilio account SID | |
| `TWILIO_AUTH_TOKEN` | worker | no | Twilio auth token | |
| `TWILIO_WHATSAPP_FROM` | worker | no | WhatsApp sender (Twilio) | `whatsapp:+...` |

Prisma is configured with `binaryTargets = ["native", "rhel-openssl-3.0.x"]` in `packages/db/prisma/schema.prisma` so the query engine matches Vercel’s Linux runtime.

## Deploying to Vercel (web)

1. From the monorepo root, link the project: `vercel link --yes`
2. Add environment variables: `vercel env add <NAME>` for each required variable (use Production / Preview / Development as needed).
3. Deploy: `vercel deploy --prod`

### Build configuration

[`vercel.json`](../vercel.json) at the repo root sets:

- `installCommand`: `pnpm install`
- `buildCommand`: `bash scripts/vercel-build.sh`
- `outputDirectory`: `apps/web/.next`
- `framework`: `nextjs`

[`scripts/vercel-build.sh`](../scripts/vercel-build.sh) runs `pnpm --filter @dropflow/db exec prisma generate`, then copies the generated Prisma client (including the **rhel-openssl-3.0.x** query engine binary) from the pnpm store’s `.prisma/client` directory into `apps/web/.prisma/client/`, because Vercel serverless resolves the engine under `/var/task/apps/web/.prisma/client` at runtime. It finishes with `pnpm --filter web build`.

## Deploying to Fly.io (worker)

1. From `apps/worker`, create or attach an app: `fly launch` (follow prompts; Dockerfile and `fly.toml` are already in this directory).
2. Set secrets, for example: `fly secrets set DATABASE_URL="..." WORKER_SECRET="..."`  
   If you use external Redis instead of the bundled daemon, set `REDIS_URL` accordingly.
3. Deploy: `fly deploy`

### Dockerfile

[`apps/worker/Dockerfile`](../apps/worker/Dockerfile) is a multi-stage build on `node:20-alpine`: install pnpm, copy workspace manifests and sources, build `@dropflow/db`, `@dropflow/types`, `@dropflow/gst`, `@dropflow/config`, and `worker`. The runtime stage installs `redis` (Alpine package), copies `dist` and packages, exposes port **3001**, and runs [`start.sh`](../apps/worker/start.sh), which starts `redis-server` locally then `node apps/worker/dist/index.js`.

### fly.toml

[`apps/worker/fly.toml`](../apps/worker/fly.toml) defines:

- App name: `dropflow-worker`
- Primary region: `sin`
- Build: `Dockerfile` in this app directory
- Non-secret env defaults: `NODE_ENV=production`, `PORT=3001`, `REDIS_URL=redis://localhost:6379`
- Public service on 80/443 proxying to `internal_port = 3001`
- HTTP health check: `GET /health` every 15s
- VM: 1 shared CPU, 512 MB RAM; machines may auto-stop when idle (`min_machines_running = 0`)

## Database (Neon)

Run Prisma commands from the repo root using the `@dropflow/db` package:

| Task | Command |
|------|---------|
| Schema push (prototyping) | `pnpm db:push` |
| Migrations (dev) | `pnpm db:migrate` |
| Seed | `pnpm db:seed` |
| Studio | `pnpm db:studio` |

Ensure `DATABASE_URL` and, for migrations against Neon, `DIRECT_DATABASE_URL` are set in your shell or `.env` for `packages/db`.

## Production URLs

| Service | URL |
|---------|-----|
| Web | https://dropflow-beta.vercel.app |
| Worker | Fly.io (configured as `dropflow-worker`; not yet deployed to a public URL) |

## Changelog

- **2026-03-30:** Vercel deployment live; Fly.io Dockerfile and `fly.toml` ready for worker deploy.
