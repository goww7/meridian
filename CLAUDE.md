# Meridian — Development Guide for Claude Code

## Project Overview

Meridian is a **Delivery Operating System** for software teams. It unifies planning, execution, governance, and compliance into a single platform with AI-native workflows and a graph-based data model.

## Tech Stack

- **Backend:** Node.js + TypeScript, Fastify framework
- **Database:** PostgreSQL 16 (primary), Redis 7 (cache/queues)
- **Graph Layer:** Apache AGE extension for PostgreSQL (Cypher queries over relational storage)
- **AI:** Anthropic Claude API (artifact generation)
- **Auth:** JWT + refresh tokens, RBAC, future SAML/OIDC
- **Queue:** BullMQ (Redis-backed job queue for async AI generation)
- **Frontend:** React 18 + TypeScript, Vite, TailwindCSS, React Query
- **Testing:** Vitest (unit/integration), Playwright (e2e)
- **Monorepo:** Turborepo with pnpm workspaces

## Project Structure

```
meridian/
├── apps/
│   ├── api/              # Fastify backend
│   │   ├── src/
│   │   │   ├── modules/         # Domain modules (flows, artifacts, policies, etc.)
│   │   │   ├── infra/           # DB, redis, auth, logger, queue
│   │   │   ├── graph/           # Apache AGE graph queries
│   │   │   ├── ai/              # AI agent orchestration
│   │   │   ├── integrations/    # GitHub, Slack, etc.
│   │   │   └── server.ts        # Fastify app entry
│   │   ├── migrations/          # PostgreSQL migrations
│   │   └── tests/
│   └── web/              # React frontend
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── stores/
│       │   └── api/             # API client
│       └── tests/
├── packages/
│   ├── shared/           # Shared types, constants, validation schemas (Zod)
│   └── policy-dsl/       # Policy DSL parser and evaluator
├── docs/                 # Architecture and design docs
├── turbo.json
├── package.json
└── CLAUDE.md
```

## Key Commands

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps in dev mode
pnpm dev --filter=api     # Start API only
pnpm dev --filter=web     # Start frontend only
pnpm build                # Build all packages
pnpm test                 # Run all tests
pnpm test:e2e             # Run Playwright e2e tests
pnpm lint                 # ESLint + Prettier check
pnpm db:migrate           # Run database migrations
pnpm db:seed              # Seed development data
pnpm graph:init           # Initialize Apache AGE extension and graph schema
```

## Conventions

- Use `snake_case` for database columns and API response fields
- Use `camelCase` for TypeScript variables and function names
- Use `PascalCase` for TypeScript types, interfaces, and React components
- Every API endpoint must have Zod request/response validation
- Every module exports from an `index.ts` barrel file
- Database queries use parameterized queries — never string interpolation
- AI-generated artifacts always require human approval before becoming active
- All mutations must emit domain events for the graph layer to consume
- Error responses follow RFC 7807 Problem Details format
- Use `ulid` for all entity IDs (sortable, URL-safe)

## Environment Variables

```
DATABASE_URL=postgresql://meridian:meridian@localhost:5432/meridian
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_APP_ID=...
GITHUB_PRIVATE_KEY=...
JWT_SECRET=...
PORT=3001
WEB_PORT=5173
NODE_ENV=development
```

## Module Pattern

Each domain module follows this structure:

```
modules/flows/
├── flows.routes.ts       # Fastify route definitions
├── flows.service.ts      # Business logic
├── flows.repository.ts   # Database queries
├── flows.schema.ts       # Zod validation schemas
├── flows.types.ts        # TypeScript types
├── flows.events.ts       # Domain events
└── flows.test.ts         # Tests
```

## Graph Conventions

- Graph name: `meridian_graph`
- Node labels: PascalCase (`Flow`, `Artifact`, `Requirement`)
- Edge labels: UPPER_SNAKE_CASE (`HAS_OBJECTIVE`, `IMPLEMENTS`, `PRODUCES`)
- All graph mutations happen via domain event handlers, not direct writes
- Every node stores `entity_id` matching the relational ID and `entity_type`

## AI Agent Conventions

- All AI calls go through `apps/api/src/ai/agent.ts`
- Use structured output (JSON mode) for all generations
- Every generation is stored as an `ArtifactVersion` before approval
- Prompts live in `apps/api/src/ai/prompts/` as template files
- Token usage is tracked per-org for billing
