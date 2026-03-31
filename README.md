<div align="center">

# Meridian

### The Delivery Operating System for Software Teams

Unify planning, execution, governance, and compliance into a single platform<br/>with AI-native workflows and a graph-based data model.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Claude AI](https://img.shields.io/badge/Claude_AI-Anthropic-D4A574?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![Tests](https://img.shields.io/badge/UAT_Tests-74_passing-brightgreen)](https://github.com/goww7/meridian/actions)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

**[Live Demo](https://meridian.halalterminal.com)** &bull; **[Getting Started](#-getting-started)** &bull; **[Architecture](#-system-architecture)** &bull; **[User Journey](#-user-journey)** &bull; **[API Reference](#-api-modules)**

</div>

---

## The Problem

Software delivery is broken into silos:

| What teams need | Where it lives today |
|----------------|---------------------|
| Strategic planning | Slides, Notion docs |
| Requirements | Confluence, Google Docs |
| Task tracking | Jira, Linear, GitHub Issues |
| CI/CD evidence | Jenkins, GitHub Actions (logs lost in time) |
| Compliance proof | Spreadsheets, email threads |
| Governance decisions | Meeting notes, Slack messages |
| Release readiness | "I think we're good?" |

Teams lose traceability. Auditors lose patience. Leadership loses confidence.

## The Solution

**Meridian** is a single system of record that traces every delivery artifact from strategic initiative down to deployment evidence — with AI that generates specs, evaluates policies, and surfaces risks automatically.

```
  Strategy          Execution           Governance          Compliance
 ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │Initiative│───▶│ Requirements │───▶│ Policy Gates │───▶│  Evidence    │
 │Objective │    │ Tasks        │    │ Approvals    │    │  Audit Trail │
 │ PRD (AI) │    │ Artifacts    │    │ RBAC         │    │  Readiness   │
 └──────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                          │                                      │
                          └──────── Full Traceability ───────────┘
```

---

## Features at a Glance

| Feature | Description |
|---------|-------------|
| **Delivery Flows** | Structured stages: Assess &rarr; Plan &rarr; Build &rarr; Release &rarr; Done |
| **AI Artifacts** | Generate assessments, PRDs, architecture docs, test plans, runbooks, release notes via Claude AI |
| **Policy Gates** | Custom DSL-based policies that block stage transitions until requirements are met |
| **Full Traceability** | Graph-based model: Initiative &rarr; Objective &rarr; Requirement &rarr; Task &rarr; Evidence |
| **Evidence Collection** | Auto-collect from GitHub (CI checks, PR reviews, deployments) or submit manually |
| **Release Readiness** | Real-time dashboards showing requirement coverage, evidence gaps, and policy compliance |
| **RBAC** | 4-tier roles: Owner &rarr; Admin &rarr; Member &rarr; Viewer |
| **GitHub Integration** | Repo linking, issue sync, webhook-driven evidence collection |
| **Real-Time Updates** | WebSocket-powered live updates across all connected clients |
| **Notifications** | In-app notification bell + Slack webhook integration |
| **Search** | Full-text search across flows, requirements, and tasks (PostgreSQL tsvector) |
| **Analytics** | Flows by stage, evidence coverage, completion trends |
| **Audit Log** | Complete audit trail of every action with actor, timestamp, and entity |

---

## User Journey

### 1. Create a Delivery Flow

A flow represents a unit of work moving through your delivery pipeline.

```
  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ ASSESS  │────▶│  PLAN   │────▶│  BUILD  │────▶│ RELEASE │────▶│  DONE   │
  │         │     │         │     │         │     │         │     │         │
  │ AI Gen  │     │ AI Gen  │     │ Tasks   │     │Evidence │     │Complete │
  │Assessment│    │  PRD    │     │ Code    │     │Readiness│     │         │
  └─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
       │               │               │               │
       ▼               ▼               ▼               ▼
   ┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
   │ Gate:  │     │ Gate:  │     │ Gate:  │     │ Gate:  │
   │Approved│     │Approved│     │  All   │     │Evidence│
   │Assessment│   │  PRD   │     │ Tests  │     │Complete│
   └────────┘     └────────┘     │ Pass   │     │No Gaps │
                                 └────────┘     └────────┘
```

### 2. Build the Traceability Chain

Every piece of work is connected to why it exists and what proves it works:

```
  Initiative: "Improve Payment Processing"
    │
    ├── Objective: "Reduce payment failures by 50%"
    │     │
    │     ├── Requirement: "Implement retry logic with exponential backoff"
    │     │     │
    │     │     ├── Task: "Build PaymentRetryService" ──▶ GitHub Issue #42
    │     │     │     │
    │     │     │     └── Evidence: CI tests passing (auto-collected)
    │     │     │
    │     │     └── Task: "Add circuit breaker for gateway timeouts"
    │     │           │
    │     │           └── Evidence: Code review approved (auto-collected)
    │     │
    │     └── Requirement: "Add monitoring dashboard for payment metrics"
    │           │
    │           └── Task: "Create Grafana dashboard"
    │                 │
    │                 └── Evidence: Manual deployment verification
    │
    └── Objective: "Support 3 new payment providers"
          │
          └── ...
```

### 3. Generate AI Artifacts

At each stage, Meridian generates structured documents using Claude AI:

| Stage | Artifact | What it contains |
|-------|----------|-----------------|
| Assess | **Assessment** | Risk analysis, feasibility, resource estimation, recommendations |
| Plan | **PRD** | Problem statement, user stories, acceptance criteria, scope |
| Plan | **Architecture** | Components, data flow, technology choices, deployment topology |
| Build | **Test Plan** | Test strategy, test cases per requirement, environments, exit criteria |
| Release | **Runbook** | Deployment steps, rollback procedure, monitoring checks |
| Release | **Release Notes** | Summary, features, fixes, known issues, migration steps |

Every artifact is **versioned**, **reviewed**, and requires **human approval** before becoming active. Token usage is tracked per-organization.

### 4. Enforce Policy Gates

Define policies that evaluate real data. Stage transitions are blocked until policies pass:

```
Policy: "require-approved-assessment"
  Stage: assess
  Severity: blocking
  Rules:
    require:
      artifacts.assessment.status: "approved"

Policy: "require-security-scan-high"
  Stage: release
  Severity: blocking
  When:
    flow.sensitivity: "high"
  Rules:
    require:
      evidence.security_scan.passing: { $gte: 1 }
      evidence.security_scan.failing: { $eq: 0 }
```

### 5. Achieve Release Readiness

The readiness dashboard shows exactly where you stand:

```
  Release Readiness: Payment API v2
  ══════════════════════════════════════════════

  Status: READY

  Requirements:  8/8 covered       ████████████ 100%
  Evidence:      10 passing        ████████████ 100%
                  0 failing

  Policies:
    ✓ require-approved-assessment   PASSED
    ✓ require-approved-prd          PASSED
    ✓ require-security-scan-high    PASSED
    ✓ require-test-coverage         PASSED

  Gaps: None
```

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                     │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ React    │  │ GitHub    │  │ Slack    │  │ CI/CD Webhooks   │  │
│  │ SPA      │  │ Webhooks  │  │ Webhooks │  │ (any provider)   │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │              │                  │            │
└───────┼──────────────┼──────────────┼──────────────────┼────────────┘
        │              │              │                  │
   ┌────▼──────────────▼──────────────▼──────────────────▼────────┐
   │                    Caddy (TLS + Reverse Proxy)               │
   └────┬─────────────────────────────────────────────────────────┘
        │
   ┌────▼─────────────────────────────────────────────────────────┐
   │                       FASTIFY API                             │
   │                                                               │
   │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
   │  │  Auth   │ │  Flows   │ │Artifacts │ │   Policies      │  │
   │  │  JWT    │ │  Stages  │ │  AI Gen  │ │   Gate Eval     │  │
   │  │  RBAC   │ │  Events  │ │  Approve │ │   DSL Engine    │  │
   │  └─────────┘ └──────────┘ └──────────┘ └─────────────────┘  │
   │                                                               │
   │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
   │  │Evidence │ │Traceabil.│ │  GitHub  │ │  Notifications  │  │
   │  │Collection│ │  Graph  │ │  Sync    │ │  In-App + Slack │  │
   │  │Auto+Man │ │  Gaps    │ │  Webhooks│ │  WebSocket      │  │
   │  └─────────┘ └──────────┘ └──────────┘ └─────────────────┘  │
   │                                                               │
   │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
   │  │ Search  │ │Analytics │ │  Audit   │ │  Domain Events  │  │
   │  │ tsvector│ │ Overview │ │  Log     │ │  EventBus       │  │
   │  └─────────┘ └──────────┘ └──────────┘ └─────────────────┘  │
   └────┬──────────────┬──────────────────────────────────────────┘
        │              │
   ┌────▼────┐    ┌────▼─────┐
   │PostgreSQL│    │  Redis   │
   │  + AGE  │    │  7       │
   │  Graph  │    │  BullMQ  │
   └─────────┘    └──────────┘
```

### Data Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    RELATIONAL LAYER (PostgreSQL)                  │
│                                                                  │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │
│  │ users  │  │  orgs  │  │ teams  │  │ flows  │  │policies│   │
│  └────────┘  └────────┘  └────────┘  └───┬────┘  └────────┘   │
│                                          │                      │
│  ┌───────────┐  ┌──────────┐  ┌─────────▼──┐  ┌───────────┐   │
│  │initiatives│  │objectives│  │requirements│  │  tasks     │   │
│  └───────────┘  └──────────┘  └────────────┘  └───────────┘   │
│                                                                  │
│  ┌───────────┐  ┌──────────┐  ┌────────────┐  ┌───────────┐   │
│  │ artifacts │  │ evidence │  │   events   │  │notifications│  │
│  └───────────┘  └──────────┘  └────────────┘  └───────────┘   │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │github_installs  │  │github_repo_links │  │github_issues │   │
│  └─────────────────┘  └──────────────────┘  └──────────────┘   │
│                                                                  │
│  Full-text search: tsvector + GIN indexes on flows,             │
│  requirements, and tasks                                         │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    GRAPH LAYER (Apache AGE)                       │
│                                                                  │
│  Graph: meridian_graph                                           │
│                                                                  │
│  Nodes: Flow, Initiative, Objective, Requirement,                │
│         Task, Evidence, Artifact                                 │
│                                                                  │
│  Edges: HAS_INITIATIVE, HAS_OBJECTIVE, HAS_REQUIREMENT,         │
│         IMPLEMENTED_BY, HAS_EVIDENCE, HAS_ARTIFACT               │
│                                                                  │
│  Queries: Traceability traversal, gap detection,                 │
│           impact analysis                                        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    ASYNC LAYER (Redis + BullMQ)                  │
│                                                                  │
│  Queue: ai-generation                                            │
│  Jobs: Generate assessment, PRD, architecture, test plan,        │
│        runbook, release notes                                    │
│  Status: queued → processing → completed / failed                │
│  Polling: GET /api/v1/jobs/:id                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
meridian/
├── .github/workflows/
│   └── ci.yml                   # CI/CD: lint, typecheck, test, UAT
├── apps/
│   ├── api/                     # Fastify backend
│   │   ├── Dockerfile           # Production multi-stage build
│   │   ├── migrations/          # 14 SQL migrations
│   │   ├── src/
│   │   │   ├── ai/              # Claude AI integration + prompts
│   │   │   ├── graph/           # Apache AGE graph init
│   │   │   ├── infra/           # DB, Redis, Auth, Logger, Events, WebSocket
│   │   │   └── modules/         # 17 domain modules
│   │   │       ├── auth/        #   JWT + refresh tokens
│   │   │       ├── orgs/        #   Organization management
│   │   │       ├── teams/       #   Team structure
│   │   │       ├── flows/       #   Delivery flows + stage lifecycle
│   │   │       ├── initiatives/ #   Strategic initiatives
│   │   │       ├── objectives/  #   OKR-style objectives
│   │   │       ├── requirements/#   Functional/non-functional reqs
│   │   │       ├── tasks/       #   Task assignment + tracking
│   │   │       ├── artifacts/   #   AI-generated versioned docs
│   │   │       ├── evidence/    #   Compliance evidence
│   │   │       ├── policies/    #   Policy DSL + gate evaluation
│   │   │       ├── graph/       #   Traceability + gap analysis
│   │   │       ├── github/      #   GitHub webhooks + sync
│   │   │       ├── audit/       #   Audit event log
│   │   │       ├── notifications/ # In-app notifications
│   │   │       ├── slack/       #   Slack webhook integration
│   │   │       └── search/      #   Full-text search + analytics
│   │   └── tests/uat/           # 74 UAT tests
│   └── web/                     # React 18 SPA
│       ├── Dockerfile           # Production nginx build
│       ├── nginx.conf           # Reverse proxy + SPA fallback
│       └── src/
│           ├── components/      # UI kit, search, notifications
│           ├── hooks/           # React Query hooks
│           ├── lib/             # API client, auth, WebSocket
│           └── pages/           # Dashboard, Flows, Policies,
│                                # Settings, Audit, Analytics
├── packages/
│   ├── shared/                  # Types, constants, Zod schemas
│   └── policy-dsl/              # Policy DSL parser + evaluator
├── docker-compose.yml           # Dev: PostgreSQL (AGE) + Redis
├── docker-compose.prod.yml      # Prod: full stack
└── turbo.json                   # Monorepo pipeline
```

---

## API Modules

| Module | Endpoints | Description |
|--------|-----------|-------------|
| **auth** | 4 | JWT login, register, refresh, logout |
| **orgs** | 5 | Organization CRUD, member management |
| **teams** | 7 | Team CRUD, member assignment |
| **flows** | 7 | Flow CRUD, stage transitions, readiness |
| **initiatives** | 5 | Strategic initiative CRUD |
| **objectives** | 4 | Objective CRUD under initiatives |
| **requirements** | 5 | Requirement CRUD with acceptance criteria |
| **tasks** | 5 | Task CRUD with status tracking |
| **artifacts** | 9 | AI generation, versioning, approve/reject |
| **evidence** | 4 | Evidence submission and collection |
| **policies** | 6 | Policy CRUD, dry-run evaluation |
| **graph** | 3 | Traceability, gap detection, impact analysis |
| **github** | 8 | Webhooks, installations, repo linking, issue sync |
| **audit** | 1 | Filtered, paginated audit event log |
| **notifications** | 4 | List, unread count, mark read |
| **slack** | 4 | Webhook CRUD, test message |
| **search** | 2 | Full-text search, analytics overview |

**Total: 83 API endpoints across 17 modules**

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18, TypeScript, Vite | SPA with real-time updates |
| **Styling** | TailwindCSS, Radix UI | Design system |
| **State** | React Query, WebSocket | Server state + live sync |
| **Backend** | Node.js, Fastify 5, TypeScript | High-performance API |
| **Database** | PostgreSQL 16 + Apache AGE | Relational + graph queries |
| **Search** | PostgreSQL tsvector + GIN | Full-text search |
| **Cache/Queue** | Redis 7, BullMQ | Async AI job processing |
| **AI** | Anthropic Claude API | Artifact generation (6 types) |
| **Auth** | JWT + Argon2 + RBAC | 4-tier role-based access |
| **Validation** | Zod | Shared frontend/backend schemas |
| **Integrations** | GitHub App, Slack Webhooks | Auto-evidence, notifications |
| **Infra** | Docker, Caddy, GitHub Actions | Build, deploy, TLS |
| **Monorepo** | Turborepo, pnpm workspaces | Build orchestration |
| **Testing** | Vitest (74 UAT tests) | End-to-end API coverage |

---

## Getting Started

### Prerequisites

- **Node.js** 22+
- **pnpm** 9+
- **Docker** (for PostgreSQL and Redis)

### Quick Start

```bash
# Clone and install
git clone https://github.com/goww7/meridian.git
cd meridian
pnpm install

# Start infrastructure
docker compose up -d

# Setup database
pnpm db:migrate
pnpm graph:init

# Build packages
pnpm build

# Start development servers
pnpm dev
```

The API runs on **http://localhost:3001** and the frontend on **http://localhost:5173**.

### Seed Demo Data

```bash
pnpm uat    # Seeds 6 flows, 5 users, policies, evidence + runs 74 tests
```

**Demo accounts** (password: `demo1234`):

| Email | Role | Can do |
|-------|------|--------|
| `alice@meridian.dev` | Owner | Everything |
| `bob@meridian.dev` | Admin | Manage teams, policies, approve artifacts |
| `carol@meridian.dev` | Member | Create flows, tasks, submit evidence |
| `dave@meridian.dev` | Member | Create flows, tasks, submit evidence |
| `eve@meridian.dev` | Viewer | Read-only access |

### Production Deployment

```bash
# Using Docker Compose
docker compose -f docker-compose.prod.yml up -d

# Or build individual images
docker build -f apps/api/Dockerfile -t meridian-api .
docker build -f apps/web/Dockerfile -t meridian-web .
```

### Run Tests

```bash
pnpm test           # Unit tests
pnpm uat            # Full UAT suite (74 tests)
pnpm lint           # ESLint + Prettier
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `ANTHROPIC_API_KEY` | For AI | Claude API key for artifact generation |
| `GITHUB_APP_ID` | For GitHub | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | For GitHub | GitHub App private key |
| `GITHUB_WEBHOOK_SECRET` | For GitHub | Webhook signature verification |
| `PORT` | No | API port (default: 3001) |
| `NODE_ENV` | No | Environment (default: development) |

---

## Conventions

| Area | Convention |
|------|-----------|
| Database columns | `snake_case` |
| API response fields | `snake_case` |
| TypeScript variables | `camelCase` |
| Types & Components | `PascalCase` |
| Entity IDs | ULID (sortable, URL-safe) |
| Error responses | RFC 7807 Problem Details |
| Graph node labels | PascalCase (`Flow`, `Artifact`) |
| Graph edge labels | UPPER_SNAKE_CASE (`HAS_OBJECTIVE`) |
| Mutations | Emit domain events &rarr; graph + notifications + WebSocket |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

Please ensure all 74 UAT tests pass before submitting.

## License

MIT

---

<div align="center">

**Built with Meridian &mdash; ship with confidence.**

[Live Demo](https://meridian.halalterminal.com) &bull; [GitHub](https://github.com/goww7/meridian) &bull; [Report Issue](https://github.com/goww7/meridian/issues)

</div>
