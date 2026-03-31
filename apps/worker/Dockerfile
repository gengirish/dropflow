FROM node:20-alpine AS base
WORKDIR /app

RUN npm install -g pnpm@9.15.9

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/

RUN pnpm install --shamefully-hoist
RUN pnpm --filter @dropflow/db exec prisma generate

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/worker/ ./apps/worker/
COPY --from=base /app/packages ./packages
COPY --from=base /app/package.json ./
COPY --from=base /app/tsconfig.base.json ./

RUN apk add --no-cache redis

COPY apps/worker/start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3001
CMD ["./start.sh"]
