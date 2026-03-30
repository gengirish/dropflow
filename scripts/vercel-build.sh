#!/bin/bash
set -e

# Generate Prisma client
pnpm --filter @dropflow/db exec prisma generate

# Copy Prisma engine + generated files to where Vercel serverless functions look
# Prisma searches: /var/task/apps/web/.prisma/client at runtime
PRISMA_GENERATED=$(find node_modules/.pnpm -path "*/.prisma/client" -type d -print -quit 2>/dev/null)
if [ -n "$PRISMA_GENERATED" ]; then
  mkdir -p apps/web/.prisma/client
  cp -r "$PRISMA_GENERATED"/* apps/web/.prisma/client/
  echo "Copied Prisma generated client from $PRISMA_GENERATED to apps/web/.prisma/client/"
  ls -la apps/web/.prisma/client/libquery_engine* 2>/dev/null || echo "WARNING: No engine binary found"
fi

# Build Next.js
pnpm --filter web build
