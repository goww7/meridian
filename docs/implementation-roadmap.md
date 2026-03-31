# Meridian — Implementation Roadmap

## Overview

This roadmap breaks the Meridian vision into concrete implementation sprints. Each sprint is 2 weeks. The goal is to reach a working MVP by Sprint 6 (12 weeks).

## Dependency Graph

```
Sprint 1: Project Setup + DB Schema
    │
    ├── Sprint 2: Auth + Orgs + Teams
    │       │
    │       ├── Sprint 3: Flows + Stage Transitions + Events
    │       │       │
    │       │       ├── Sprint 4: Artifacts + AI Generation
    │       │       │       │
    │       │       │       ├── Sprint 5: Requirements + Tasks + Evidence
    │       │       │       │       │
    │       │       │       │       └── Sprint 6: Policies + Gates + Readiness
    │       │       │       │               │
    │       │       │       │               └── Sprint 7: GitHub Integration
    │       │       │       │                       │
    │       │       │       │                       └── Sprint 8: Polish + E2E + Deploy
    │       │       │
    │       │       └── Sprint 3b: Graph Layer (parallel)
    │       │
    │       └── Sprint 2b: Frontend Scaffolding (parallel)
```

---

## Sprint 1: Project Scaffolding & Database (Weeks 1-2)

### Goals
- Monorepo structure with all packages
- PostgreSQL + Apache AGE running
- All migrations written and passing
- Dev environment fully functional

### Tasks

**Monorepo setup:**
- [ ] Initialize Turborepo with pnpm workspaces
- [ ] Create `apps/api` with Fastify + TypeScript
- [ ] Create `apps/web` with Vite + React + TypeScript + Tailwind
- [ ] Create `packages/shared` with Zod schemas and types
- [ ] Create `packages/policy-dsl` (empty, placeholder)
- [ ] Configure ESLint, Prettier, tsconfig
- [ ] Create `docker-compose.yml` for PostgreSQL (AGE) and Redis
- [ ] Create `.env.example`

**Database:**
- [ ] Write ULID generation function
- [ ] Write all migrations (001-018)
- [ ] Create `pnpm db:migrate` command
- [ ] Create seed script with sample data
- [ ] Initialize Apache AGE graph schema
- [ ] Verify RLS policies work

**API foundation:**
- [ ] Fastify app with plugin registration
- [ ] Pino logger configuration
- [ ] Health check endpoints (`/health`, `/health/ready`)
- [ ] Error handler (RFC 7807)
- [ ] Database connection pool
- [ ] Redis client
- [ ] Request validation with Zod type provider

### Deliverable
Running API that responds to health checks, connected to PostgreSQL + Redis.

---

## Sprint 2: Authentication & Organization (Weeks 3-4)

### Goals
- Users can register, login, and refresh tokens
- Org creation and member management
- RBAC middleware
- Team CRUD

### Tasks

**Auth module:**
- [ ] User registration (argon2 password hashing)
- [ ] Login endpoint (JWT issuance)
- [ ] Refresh token endpoint (rotation)
- [ ] Logout endpoint (token revocation)
- [ ] Auth middleware (JWT verification)
- [ ] Rate limiting on auth endpoints

**Org module:**
- [ ] Get current org
- [ ] Update org settings
- [ ] List org members
- [ ] Invite member (email)
- [ ] Update member role
- [ ] Remove member

**RBAC:**
- [ ] Role hierarchy (owner > admin > member > viewer)
- [ ] `requireRole()` middleware
- [ ] `requireFlowAccess()` middleware
- [ ] RLS tenant isolation via `SET LOCAL app.current_org_id`

**Team module:**
- [ ] Team CRUD
- [ ] Team member management

**Shared package:**
- [ ] All Zod schemas for auth/org/team endpoints
- [ ] TypeScript types for all entities defined so far

### Deliverable
Users can sign up, log in, and manage their organization and teams.

---

## Sprint 2b: Frontend Scaffolding (Weeks 3-4, parallel)

### Goals
- React app running with routing
- Auth flow (login/register)
- App layout with sidebar navigation
- Design system primitives

### Tasks

- [ ] React Router setup with all route stubs
- [ ] Auth provider (token storage, refresh, redirect)
- [ ] API client with auth header injection
- [ ] React Query provider
- [ ] App layout component (sidebar + header + content area)
- [ ] Login page
- [ ] Register page
- [ ] Dashboard page (placeholder)
- [ ] Radix UI + Tailwind design primitives (button, input, card, badge, dialog, table)
- [ ] Stage badge component (assess/plan/build/release colors)
- [ ] Settings page (org name, members list)

### Deliverable
Users can register, log in, and see the dashboard skeleton via the web app.

---

## Sprint 3: Flows & Stage Transitions (Weeks 5-6)

### Goals
- Full flow CRUD
- Stage transition with validation
- Event system operational
- Flow list and detail pages in frontend

### Tasks

**Flow module:**
- [ ] Create flow
- [ ] List flows with filtering (stage, status, priority, team, search)
- [ ] Get flow detail
- [ ] Update flow
- [ ] Delete flow (soft delete)
- [ ] Cursor-based pagination

**Stage transitions:**
- [ ] Transition endpoint (`POST /flows/:id/transition`)
- [ ] Stage order validation (assess → plan → build → release → done)
- [ ] Stage history recording (`flow_stage_transitions` table)
- [ ] Stage revert (admin only)

**Event system:**
- [ ] In-process EventEmitter with typed events
- [ ] Event persistence to `events` table
- [ ] `flow.created`, `flow.stage_changed`, `flow.updated` events

**Initiative & Objective modules:**
- [ ] Initiative CRUD (linked to flows)
- [ ] Objective CRUD (linked to initiatives)

**Frontend:**
- [ ] Flow list page with filters
- [ ] Flow create dialog
- [ ] Flow detail page (overview tab)
- [ ] Flow stage timeline component
- [ ] Flow transition dialog

### Deliverable
Users can create flows, view them in a list, and manually advance stages.

---

## Sprint 3b: Graph Layer (Weeks 5-6, parallel)

### Goals
- Graph projection from domain events
- Basic traceability queries working

### Tasks

- [ ] Graph event handlers (listen to domain events, create/update nodes and edges)
- [ ] `Flow`, `Initiative`, `Objective` node projections
- [ ] Edge projections: `HAS_INITIATIVE`, `HAS_OBJECTIVE`
- [ ] Graph query service with typed Cypher queries
- [ ] Basic traceability endpoint (`GET /flows/:id/trace`)
- [ ] Graph rebuild command (rebuild from events table)
- [ ] Integration tests for graph queries against real AGE

### Deliverable
Graph layer stays in sync with relational data and can answer basic traceability queries.

---

## Sprint 4: Artifacts & AI Generation (Weeks 7-8)

### Goals
- AI-generated artifacts (assessment, PRD)
- Artifact versioning and approval workflow
- BullMQ job queue for async generation

### Tasks

**Artifact module:**
- [ ] Artifact CRUD
- [ ] Artifact version management
- [ ] Approve/reject artifacts
- [ ] List artifact versions

**AI subsystem:**
- [ ] BullMQ queue setup (ai-generation queue)
- [ ] AI worker process
- [ ] Context builder (flow + org + previous artifacts)
- [ ] Prompt templates for assessment and PRD
- [ ] Claude API integration (`@anthropic-ai/sdk`)
- [ ] Structured JSON output parsing and validation
- [ ] Markdown rendering from structured content
- [ ] Token usage tracking
- [ ] Job status polling endpoint

**Generation endpoint:**
- [ ] `POST /flows/:id/artifacts/generate` → enqueue job → return 202
- [ ] `GET /jobs/:id` → poll status
- [ ] Regenerate with feedback
- [ ] Manual artifact version creation (human edit)

**Frontend:**
- [ ] Artifacts tab on flow detail
- [ ] Generate artifact dialog (select type)
- [ ] Generation progress indicator
- [ ] Artifact viewer (rendered markdown)
- [ ] Artifact version history
- [ ] Approve/reject buttons

**Graph updates:**
- [ ] `Artifact` node and `HAS_ARTIFACT` edge
- [ ] `artifact.generated`, `artifact.approved` event handlers

### Deliverable
Users can generate AI assessments and PRDs, review them, and approve/reject.

---

## Sprint 5: Requirements, Tasks & Evidence (Weeks 9-10)

### Goals
- Requirements management with acceptance criteria
- Task management linked to requirements
- Evidence collection (manual)
- Full traceability chain operational

### Tasks

**Requirement module:**
- [ ] Requirement CRUD (linked to objectives)
- [ ] Acceptance criteria management
- [ ] Auto-extract requirements from approved PRD
- [ ] Requirement status tracking

**Task module:**
- [ ] Task CRUD (linked to requirements)
- [ ] Task assignment
- [ ] Task status transitions
- [ ] Task list with filters

**Evidence module:**
- [ ] Manual evidence submission
- [ ] Evidence linked to requirements
- [ ] Evidence status (passing/failing/pending)
- [ ] Evidence summary per flow

**Frontend:**
- [ ] Requirements tab with CRUD
- [ ] Tasks tab (kanban or list view)
- [ ] Evidence tab with submission dialog
- [ ] Traceability graph (React Flow visualization)
- [ ] Gap detection display

**Graph updates:**
- [ ] `Requirement`, `Task`, `Evidence` nodes
- [ ] `HAS_REQUIREMENT`, `IMPLEMENTED_BY`, `HAS_EVIDENCE` edges
- [ ] Gap detection query (requirements without evidence)
- [ ] Impact analysis query

### Deliverable
Full traceability chain from initiative → objective → requirement → task → evidence.

---

## Sprint 6: Policy Engine & Release Readiness (Weeks 11-12)

### Goals
- Policy DSL evaluator
- Gate enforcement on stage transitions
- Release readiness dashboard
- **MVP complete**

### Tasks

**Policy DSL package:**
- [ ] Condition evaluator (all operators: $eq, $gt, $gte, $lt, $lte, $in, $contains, $and, $or, $not)
- [ ] Policy context builder
- [ ] Comprehensive unit tests for evaluator

**Policy module:**
- [ ] Policy CRUD
- [ ] Default policies seeded on org creation
- [ ] Policy dry-run evaluation
- [ ] Gate evaluation on stage transition (integrate with flow transition)
- [ ] Gate evaluation history

**Readiness module:**
- [ ] Readiness endpoint (`GET /flows/:id/readiness`)
- [ ] Aggregate evidence by type and status
- [ ] Compare against policy requirements
- [ ] Identify gaps and blockers

**Frontend:**
- [ ] Policies page (list, create, edit)
- [ ] Policy rule builder (form-based)
- [ ] Gate results display on stage transition dialog
- [ ] Readiness tab on flow detail
- [ ] Readiness matrix (requirements × evidence types)

### Deliverable
**MVP is complete.** Users can create flows, generate AI artifacts, manage requirements/tasks/evidence, and enforce policy gates at stage transitions. Release readiness is visible.

---

## Sprint 7: GitHub Integration (Weeks 13-14)

### Goals
- GitHub App installation
- Bidirectional task ↔ issue sync
- Evidence collection from CI/CD

### Tasks

- [ ] GitHub App manifest and registration
- [ ] Installation flow (redirect → callback → store)
- [ ] Webhook receiver with signature verification
- [ ] Link flows to GitHub repos
- [ ] Task → GitHub issue sync (create, update, close)
- [ ] GitHub issue → task sync (close, reopen)
- [ ] PR reference detection (MRD-<task_id>)
- [ ] Evidence from check runs (test results)
- [ ] Evidence from PR reviews (code review)
- [ ] Evidence from deployment status
- [ ] Meridian check run on PRs
- [ ] Frontend: integration settings page
- [ ] Frontend: link repo to flow dialog
- [ ] Generic CI webhook endpoint

### Deliverable
GitHub integration is live. Test results and code reviews flow in as evidence automatically.

---

## Sprint 8: Polish, E2E Tests & Deployment (Weeks 15-16)

### Goals
- End-to-end tests passing
- Production deployment pipeline
- Performance optimization
- Bug fixes and polish

### Tasks

**Testing:**
- [ ] E2E test: complete flow lifecycle (assess → release)
- [ ] E2E test: gate blocks transition
- [ ] E2E test: AI artifact generation
- [ ] E2E test: GitHub evidence collection
- [ ] Load testing (k6 or artillery)
- [ ] Security audit (OWASP checklist)

**Deployment:**
- [ ] Docker images (API + Web)
- [ ] GitHub Actions CI/CD pipeline
- [ ] Staging environment setup
- [ ] Production environment setup
- [ ] Database backup strategy
- [ ] Monitoring dashboards (Grafana)
- [ ] Alerting rules

**Polish:**
- [ ] WebSocket real-time updates
- [ ] Loading states and error boundaries
- [ ] Empty states with helpful CTAs
- [ ] Responsive layout (tablet/desktop)
- [ ] Performance: lazy loading routes
- [ ] Performance: React Query stale/cache tuning
- [ ] API response time optimization (indexes, query tuning)

### Deliverable
Production-ready MVP deployed to staging with CI/CD pipeline.

---

## Post-MVP Sprints (Phase 2)

### Sprint 9-10: Advanced Governance
- Policy DSL (human-readable syntax)
- Approval workflows (multi-approver, sequential)
- SOC 2 compliance report generation
- Audit log viewer

### Sprint 11-12: Intelligence
- Architecture and test plan AI artifacts
- Runbook AI artifact
- Semantic search across artifacts
- Similar flow recommendations

### Sprint 13-14: Enterprise Features
- Multi-org support (org switching)
- SSO (SAML, OIDC)
- API key management UI
- Advanced analytics dashboard

### Sprint 15-16: Integrations
- Slack notifications
- Jira import
- GitLab integration
- Custom webhook outbound

---

## Success Criteria (MVP)

The MVP is considered successful when:

1. **A user can complete the full flow lifecycle:**
   - Create a flow
   - Generate and approve an AI assessment
   - Advance to plan, generate and approve PRD
   - Add requirements, tasks, and evidence
   - Pass policy gates at each stage
   - Reach release readiness

2. **Data is traceable:**
   - Initiative → Objective → Requirement → Task → Evidence chain is visible
   - Impact analysis and gap detection work

3. **Governance is enforced:**
   - Stage transitions respect policy gates
   - Evidence is required for release
   - Audit trail is complete

4. **Quality targets met:**
   - API response time < 200ms (p95)
   - AI generation < 30s (p95)
   - Test coverage > 80%
   - Zero critical security vulnerabilities

5. **Deployment is automated:**
   - CI/CD pipeline runs on every push
   - Staging and production environments operational
   - Monitoring and alerting in place
