# Meridian — System Architecture

## Overview

Meridian is a monorepo application consisting of a Fastify API backend, a React SPA frontend, and shared packages. It uses PostgreSQL with Apache AGE for hybrid relational + graph storage, Redis for caching and job queues, and the Anthropic Claude API for AI artifact generation.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│   React SPA  │  CLI (future)  │  GitHub Webhooks  │  Slack Bot   │
└──────┬───────┴───────┬────────┴────────┬──────────┴──────┬───────┘
       │               │                 │                 │
       ▼               ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Fastify)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │   Auth   │  │   Rate   │  │  Request  │  │   Correlation    │ │
│  │Middleware │  │ Limiter  │  │Validation │  │   ID Tracking    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                     DOMAIN MODULES                               │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────────┐ │
│  │  Flows  │ │Artifacts │ │Policies│ │Evidence│ │Integrations│ │
│  └─────────┘ └──────────┘ └────────┘ └────────┘ └────────────┘ │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────┐               │
│  │  Orgs   │ │  Users   │ │ Teams  │ │ Graph  │               │
│  └─────────┘ └──────────┘ └────────┘ └────────┘               │
├──────────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE LAYER                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │PostgreSQL│ │  Redis   │ │  BullMQ  │ │  Anthropic API   │   │
│  │+ AGE ext │ │  Cache   │ │  Queues  │ │  (Claude)        │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. API Layer (Fastify)

The API is a Fastify application organized into domain modules. Each module registers its own routes under a versioned prefix (`/api/v1/`).

**Key middleware stack (executed in order):**

1. **Correlation ID** — Generates `X-Request-Id` for every request, propagated to logs and downstream calls
2. **Auth** — Validates JWT, resolves user + org context, attaches to request
3. **Rate Limiter** — Token bucket per org, configurable per endpoint
4. **Request Validation** — Zod schemas compiled to JSON Schema for Fastify validation
5. **Org Scoping** — Ensures all queries are scoped to the authenticated org (tenant isolation)

**Route registration pattern:**

```typescript
// modules/flows/flows.routes.ts
export async function flowRoutes(app: FastifyInstance) {
  app.post('/api/v1/flows', {
    schema: { body: createFlowSchema, response: { 201: flowResponseSchema } },
    preHandler: [requireAuth, requireRole('member')],
    handler: createFlowHandler,
  });
}
```

### 2. Domain Modules

Each module owns its routes, business logic, database access, and event emissions.

| Module | Responsibility |
|--------|---------------|
| **flows** | Core delivery flow lifecycle (Assess → Plan → Build → Release) |
| **artifacts** | AI-generated documents (assessments, PRDs, test plans, runbooks) |
| **policies** | Policy definitions, DSL parsing, gate evaluation |
| **evidence** | Evidence collection, validation, linking to requirements |
| **integrations** | GitHub App, webhook handling, external sync |
| **orgs** | Organization management, billing, settings |
| **users** | User accounts, profiles, preferences |
| **teams** | Team management, membership, permissions |
| **graph** | Graph query service, traceability, impact analysis |

### 3. Database Architecture

#### PostgreSQL (Relational)

Primary data store for all entities. Provides ACID transactions, referential integrity, and full-text search.

**Key design decisions:**
- All tables include `org_id` for tenant isolation (row-level security)
- Soft deletes via `deleted_at` timestamp
- Optimistic locking via `version` column on mutable entities
- `created_at` and `updated_at` on all tables
- ULIDs for primary keys (sortable, URL-safe, no coordination needed)

#### Apache AGE (Graph)

PostgreSQL extension that adds Cypher query support. Runs inside the same PostgreSQL instance — no separate graph database.

**Why AGE over Neo4j:**
- Single database to operate (no separate cluster)
- Transactional consistency with relational data
- Reduces infrastructure complexity
- Sufficient for our query patterns (traceability, impact analysis)

**Graph is a projection of relational data:**
- Domain events trigger graph mutations
- Graph is eventually consistent with relational tables (typically < 100ms)
- Graph can be rebuilt from relational data at any time

#### Redis

- **Caching:** Session data, frequently-accessed org settings, rate limit counters
- **Queues:** BullMQ for async job processing (AI generation, webhook delivery, evidence collection)
- **Pub/Sub:** Real-time notifications to connected WebSocket clients

### 4. AI Subsystem

AI artifact generation runs asynchronously via BullMQ jobs.

```
User Request → API validates → Enqueue job → Return 202 + job_id
                                    │
                                    ▼
                              BullMQ Worker
                                    │
                         ┌──────────┼──────────┐
                         ▼          ▼          ▼
                    Load Context  Build     Call Claude
                    (flow, org,   Prompt    API
                     history)
                                    │
                                    ▼
                            Store ArtifactVersion
                            (status: draft)
                                    │
                                    ▼
                            Notify user via
                            WebSocket / email
```

**Design principles:**
- All generations produce a versioned draft — never auto-published
- Context window is managed by selecting relevant graph neighbors
- Prompts are templated and version-controlled in the repo
- Token usage is metered per org for billing
- Failed generations retry with exponential backoff (max 3 attempts)

### 5. Event System

Domain events are the backbone of cross-module communication.

```typescript
// Event emission
eventBus.emit('flow.stage_changed', {
  flowId: 'flow_01HX...',
  orgId: 'org_01HX...',
  fromStage: 'assess',
  toStage: 'plan',
  userId: 'usr_01HX...',
  timestamp: new Date(),
});

// Event handlers
eventBus.on('flow.stage_changed', graphProjectionHandler);
eventBus.on('flow.stage_changed', auditLogHandler);
eventBus.on('flow.stage_changed', policyGateHandler);
eventBus.on('flow.stage_changed', notificationHandler);
```

**Event flow:**
1. Module performs mutation and emits event
2. In-process event bus distributes to handlers
3. Critical handlers (audit log, graph) run in the same transaction
4. Non-critical handlers (notifications, webhooks) are enqueued as async jobs

**Event persistence:**
- All events are written to an `events` table (append-only audit log)
- Events older than 90 days are archived to cold storage
- Events power the graph projection rebuild

### 6. Real-Time Layer

WebSocket connections (via `@fastify/websocket`) provide real-time updates.

**Channels:**
- `org:{orgId}` — Org-wide notifications
- `flow:{flowId}` — Flow-specific updates (stage changes, artifact ready)
- `user:{userId}` — Personal notifications

**Implementation:**
- Redis Pub/Sub bridges multiple API instances
- Client reconnects with last-event-id for missed messages
- Graceful degradation — frontend polls if WebSocket unavailable

### 7. Integration Architecture

External integrations follow an adapter pattern:

```
┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│  Integration│     │   Adapter     │     │   External   │
│   Module    │────▶│  (normalize)  │────▶│   Service    │
└─────────────┘     └───────────────┘     └──────────────┘
                           │
                    ┌──────┴──────┐
                    │  Webhook    │
                    │  Receiver   │
                    └─────────────┘
```

**GitHub integration (primary):**
- Installed as a GitHub App (not OAuth — provides better permissions model)
- Bidirectional sync: Meridian tasks ↔ GitHub issues/PRs
- Webhook events: push, pull_request, check_run, deployment
- Evidence collection: CI status, test results, code review approvals

## Security Architecture

### Authentication Flow

```
1. User signs up → email/password stored (argon2 hash)
2. User logs in → receives JWT (15min) + refresh token (7 days)
3. JWT contains: { sub: userId, org: orgId, role: 'admin'|'member'|'viewer' }
4. Refresh token is rotated on use (one-time use)
5. All tokens revoked on password change
```

### Authorization Model

**RBAC with org scoping:**

| Role | Flows | Artifacts | Policies | Org Settings |
|------|-------|-----------|----------|-------------|
| **owner** | CRUD | CRUD + approve | CRUD | CRUD |
| **admin** | CRUD | CRUD + approve | CRUD | Read |
| **member** | CRUD | CRUD | Read | Read |
| **viewer** | Read | Read | Read | Read |

### Tenant Isolation

- Every table includes `org_id`
- PostgreSQL Row-Level Security (RLS) policies enforce isolation
- API middleware injects `org_id` from JWT — never from request body
- Database connections `SET app.current_org_id` for RLS evaluation

### Data Encryption

- At rest: PostgreSQL TDE or volume encryption
- In transit: TLS 1.3 for all connections
- Secrets: Stored in environment variables, never in database
- PII: Identified and flagged in data model, encrypted at field level where required

## Scalability Considerations

### Horizontal Scaling

```
                    ┌─────────────┐
                    │   Load      │
                    │   Balancer  │
                    └──────┬──────┘
               ┌───────────┼───────────┐
               ▼           ▼           ▼
          ┌────────┐  ┌────────┐  ┌────────┐
          │ API 1  │  │ API 2  │  │ API N  │
          └────────┘  └────────┘  └────────┘
               │           │           │
               ▼           ▼           ▼
          ┌─────────────────────────────────┐
          │     PostgreSQL (primary)        │
          │     + read replicas             │
          └─────────────────────────────────┘
```

- API instances are stateless — scale horizontally behind a load balancer
- Redis Pub/Sub ensures WebSocket messages reach all instances
- BullMQ workers can run as separate processes or in-process
- Database read replicas for graph queries and analytics
- Connection pooling via PgBouncer

### Performance Targets

| Metric | Target |
|--------|--------|
| API response time (p95) | < 200ms |
| AI generation time (p95) | < 30s |
| Graph traversal (p95) | < 500ms |
| WebSocket latency | < 100ms |
| Concurrent users per instance | 1,000 |

## Observability

### Logging

- Structured JSON logs via Pino (Fastify default)
- Correlation ID in every log entry
- Log levels: `fatal`, `error`, `warn`, `info`, `debug`, `trace`
- Shipped to centralized logging (ELK / Datadog)

### Metrics

- Prometheus-compatible metrics endpoint (`/metrics`)
- Key metrics: request rate, error rate, latency histogram, queue depth, AI token usage
- Grafana dashboards for operational visibility

### Tracing

- OpenTelemetry SDK for distributed tracing
- Trace spans for: HTTP requests, DB queries, Redis ops, AI calls, webhook deliveries
- Exported to Jaeger or Datadog APM

### Health Checks

```
GET /health          → { status: 'ok' }
GET /health/ready    → { db: 'ok', redis: 'ok', queue: 'ok' }
GET /health/live     → { uptime: 12345 }
```
