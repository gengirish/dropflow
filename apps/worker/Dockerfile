FROM node:20-alpine AS base
WORKDIR /app

RUN npm install -g pnpm@9

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./

COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/gst/package.json ./packages/gst/
COPY packages/config/package.json ./packages/config/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/

RUN pnpm --filter @dropflow/db build
RUN pnpm --filter @dropflow/types build
RUN pnpm --filter @dropflow/gst build
RUN pnpm --filter @dropflow/config build
RUN pnpm --filter worker build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/worker/dist ./apps/worker/dist
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/worker/package.json ./apps/worker/

RUN apk add --no-cache redis

COPY apps/worker/start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3001
CMD ["./start.sh"]
