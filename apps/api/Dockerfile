FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/policy-dsl/package.json packages/policy-dsl/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/policy-dsl/node_modules ./packages/policy-dsl/node_modules
COPY . .
RUN pnpm build

FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/migrations ./apps/api/migrations
COPY --from=build /app/apps/api/src/infra/db/migrate.ts ./apps/api/src/infra/db/migrate.ts
COPY --from=build /app/apps/api/src/graph/init.ts ./apps/api/src/graph/init.ts
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/policy-dsl/dist ./packages/policy-dsl/dist
COPY --from=build /app/packages/policy-dsl/package.json ./packages/policy-dsl/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/server.js"]
