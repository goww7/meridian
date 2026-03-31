<div align="center">

# Meridian

### The Delivery Operating System for Software Teams

Unify planning, execution, governance, and compliance into a single platform with AI-native workflows and a graph-based data model.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Claude AI](https://img.shields.io/badge/Claude_AI-Anthropic-D4A574?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

**[Live Demo](https://meridian.halalterminal.com)** &bull; **[Documentation](#architecture)** &bull; **[Getting Started](#getting-started)**

</div>

## Why Meridian?

Software delivery is fragmented. Planning lives in one tool, tasks in another, compliance in spreadsheets, and governance in meetings. Teams lose visibility, auditors lose patience, and leadership loses confidence.

**Meridian fixes this.** It's a single system of record that traces every delivery artifact from strategic initiative down to deployment evidence — with AI that generates specs, evaluates policies, and surfaces risks automatically.

## Key Features

### Delivery Flows
End-to-end delivery tracking through structured stages: **Assess** &rarr; **Plan** &rarr; **Build** &rarr; **Release** &rarr; **Done**. Each transition is gated by configurable policies that enforce your team's standards.

### Full Traceability
Graph-based data model connecting **Initiatives** &rarr; **Objectives** &rarr; **Requirements** &rarr; **Tasks** &rarr; **Evidence**. Know exactly what was built, why it was built, and whether it meets your standards — at any point in time.

### AI-Powered Artifacts
Generate assessments, PRDs, and technical specs using Claude AI. Every AI-generated artifact is versioned, reviewed, and requires human approval before becoming active. Token usage is tracked per-organization.

### Policy Gates & Compliance
Define policies using a custom DSL that evaluate real delivery data. Block stage transitions when requirements aren't met. Collect evidence automatically from CI/CD, security scans, code reviews, and manual approvals.

### Release Readiness
Real-time readiness dashboards that aggregate requirement coverage, evidence status, policy evaluations, and gap analysis. Know if you're ready to ship — or exactly what's blocking you.

### Role-Based Access Control
Four-tier RBAC model: **Owner** &rarr; **Admin** &rarr; **Member** &rarr; **Viewer**. Fine-grained permissions on every operation, from creating flows to approving artifacts to managing policies.

## Architecture

```
meridian/
├── apps/
│   ├── api/                 # Fastify backend (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── modules/     # Domain modules (13 bounded contexts)
│   │   │   ├── infra/       # DB, Redis, Auth, Logger, Queue
│   │   │   ├── graph/       # Apache AGE graph queries
│   │   │   └── ai/          # Claude AI orchestration & prompts
│   │   ├── migrations/      # PostgreSQL schema migrations
│   │   └── tests/           # Unit, integration & UAT tests
│   └── web/                 # React 18 SPA
│       └── src/
│           ├── pages/       # Login, Dashboard, Flows, Policies, Settings
│           ├── components/  # Shared UI components (Radix + Tailwind)
│           └── lib/         # API client, auth context, utilities
├── packages/
│   ├── shared/              # Types, constants, Zod schemas
│   └── policy-dsl/          # Policy DSL parser & evaluator
├── docker-compose.yml       # PostgreSQL (Apache AGE) + Redis
└── turbo.json               # Monorepo pipeline config
```

### API Modules

| Module | Description |
|--------|-------------|
| **auth** | JWT + refresh tokens, registration, login |
| **orgs** | Organization management, member invites |
| **teams** | Team structure and membership |
| **flows** | Delivery flows with stage lifecycle |
| **initiatives** | Strategic initiative tracking |
| **objectives** | OKR-style objectives under initiatives |
| **requirements** | Functional/non-functional requirements |
| **tasks** | Task assignment and status tracking |
| **artifacts** | AI-generated versioned documents |
| **evidence** | Compliance evidence (tests, scans, reviews) |
| **policies** | Policy DSL definitions and gate evaluation |
| **graph** | Traceability graph and gap analysis |

### Graph Data Model

```
Flow ──HAS_INITIATIVE──▶ Initiative ──HAS_OBJECTIVE──▶ Objective
                                                          │
                                               HAS_REQUIREMENT
                                                          ▼
Flow ──HAS_ARTIFACT──▶ Artifact          Requirement ──IMPLEMENTED_BY──▶ Task
                                                                          │
                                                                    HAS_EVIDENCE
                                                                          ▼
                                                                       Evidence
```

Built on **Apache AGE** — Cypher graph queries over PostgreSQL, combining relational reliability with graph traversal power.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Radix UI, React Query, React Router |
| **Backend** | Node.js, TypeScript, Fastify 5, Pino logging |
| **Database** | PostgreSQL 16 with Apache AGE graph extension |
| **Cache/Queue** | Redis 7, BullMQ for async AI jobs |
| **AI** | Anthropic Claude API (structured output, versioned artifacts) |
| **Auth** | JWT + refresh tokens, Argon2 hashing, 4-tier RBAC |
| **Validation** | Zod schemas shared between frontend and backend |
| **Monorepo** | Turborepo, pnpm workspaces |
| **Testing** | Vitest (unit/integration/UAT), Playwright (e2e) |

## Getting Started

### Prerequisites

- **Node.js** 22+
- **pnpm** 9+
- **Docker** (for PostgreSQL and Redis)

### Setup

```bash
# Clone the repository
git clone https://github.com/goww7/meridian.git
cd meridian

# Install dependencies
pnpm install

# Start PostgreSQL (Apache AGE) and Redis
docker compose up -d

# Run database migrations and initialize graph
pnpm db:migrate
pnpm graph:init

# Build shared packages
pnpm build

# Start development servers
pnpm dev
```

The API runs on **http://localhost:3001** and the frontend on **http://localhost:5173**.

### Seed Demo Data

```bash
pnpm db:seed        # Basic seed data
pnpm uat            # Full UAT dataset with 6 flows, 5 users, policies, evidence
```

**Demo accounts** (password: `demo1234`):

| Email | Role | Access |
|-------|------|--------|
| alice@meridian.dev | Owner | Full access |
| bob@meridian.dev | Admin | Manage + approve |
| carol@meridian.dev | Member | Create + edit |
| dave@meridian.dev | Member | Create + edit |
| eve@meridian.dev | Viewer | Read only |

### Run Tests

```bash
pnpm test           # All tests
pnpm test:e2e       # Playwright end-to-end tests
pnpm uat            # Full UAT suite (74 tests)
pnpm lint           # ESLint + Prettier
```

## Environment Variables

```env
DATABASE_URL=postgresql://meridian:meridian@localhost:5432/meridian
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret-here
PORT=3001
WEB_PORT=5173
NODE_ENV=development
```

## Conventions

- **Database/API fields**: `snake_case`
- **TypeScript variables**: `camelCase`
- **Types & Components**: `PascalCase`
- **Entity IDs**: ULID (sortable, URL-safe)
- **Errors**: RFC 7807 Problem Details format
- **Graph nodes**: PascalCase labels (`Flow`, `Artifact`)
- **Graph edges**: UPPER_SNAKE_CASE (`HAS_OBJECTIVE`, `IMPLEMENTS`)
- **Mutations**: Emit domain events consumed by the graph layer

## License

MIT

---

<div align="center">
Built with Meridian &mdash; ship with confidence.
</div>
