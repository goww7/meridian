# Meridian — Complete Implementation Prompt

You are working on **Meridian**, a Delivery Operating System at `/root/meridian`. Read `CLAUDE.md` for full project context. The API server runs on port 3001, frontend on port 5173, PostgreSQL (Apache AGE) and Redis via Docker Compose.

**Current state:** Sprints 1–6 are complete. 74 UAT tests pass. The app is deployed at https://meridian.halalterminal.com. Auth, flows, artifacts, evidence, policies, traceability, RBAC — all working.

**Your job:** Implement everything below. Work sequentially through each section. After each section, run the relevant tests to confirm nothing is broken. Commit after each major section.

---

## SECTION 1: GitHub Actions CI/CD Pipeline

Create `.github/workflows/ci.yml`:

```yaml
triggers: push to main, pull requests to main
jobs:
  - lint: pnpm lint
  - typecheck: pnpm build (includes tsc)
  - test-unit: pnpm test (vitest unit tests)
  - test-uat:
    - start postgres (apache/age) and redis via services
    - pnpm install, pnpm build
    - pnpm db:migrate, pnpm graph:init
    - start API server in background
    - pnpm uat
```

Use `pnpm` caching. Node 22. Ensure all jobs use the correct env vars (DATABASE_URL, REDIS_URL, JWT_SECRET=ci-test-secret, NODE_ENV=test).

---

## SECTION 2: Dockerfiles for Production

### `apps/api/Dockerfile`
- Multi-stage build: install deps → build → production image
- Base: `node:22-alpine`
- Use pnpm with `--frozen-lockfile`
- Copy built packages (shared, policy-dsl)
- Run with `node dist/server.js`
- Expose port 3001

### `apps/web/Dockerfile`
- Multi-stage: install → build → nginx:alpine
- Build the Vite app with `pnpm build --filter=@meridian/web`
- Serve from nginx with SPA fallback (`try_files $uri /index.html`)
- Include nginx config that proxies `/api` to `http://api:3001`
- Expose port 80

### `docker-compose.prod.yml`
- Services: postgres, redis, api, web
- Web depends on api, api depends on postgres + redis
- API runs migrations on startup via entrypoint script
- Expose web on port 80
- Use named volumes for postgres data
- Environment variables from `.env` file

Test: `docker compose -f docker-compose.prod.yml build` should succeed.

---

## SECTION 3: GitHub Integration (Full Feature)

### 3a. Database Migration `011_create_github_installations.sql`

```sql
CREATE TABLE github_installations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  installation_id INTEGER NOT NULL UNIQUE,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL, -- 'Organization' or 'User'
  app_id INTEGER NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  events JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE github_repo_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(flow_id, repo_full_name)
);

CREATE TABLE github_issue_links (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  repo_link_id TEXT NOT NULL REFERENCES github_repo_links(id) ON DELETE CASCADE,
  issue_number INTEGER NOT NULL,
  issue_url TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional', -- 'to_github', 'from_github', 'bidirectional'
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3b. GitHub Module (`apps/api/src/modules/github/`)

Create the module following the project's module pattern:

**`github.routes.ts`** — Endpoints:
- `POST /api/v1/github/webhook` — Webhook receiver (no auth, verify signature via `X-Hub-Signature-256`)
- `GET /api/v1/github/installations` — List installations for org (requireAuth)
- `POST /api/v1/github/installations/setup` — Handle installation callback (requireAuth, requireRole admin)
- `DELETE /api/v1/github/installations/:installationId` — Remove installation (requireAuth, requireRole admin)
- `POST /api/v1/flows/:flowId/github/link` — Link repo to flow (requireAuth, requireRole member)
- `DELETE /api/v1/flows/:flowId/github/link/:linkId` — Unlink repo (requireAuth, requireRole member)
- `GET /api/v1/flows/:flowId/github/links` — List linked repos (requireAuth)
- `POST /api/v1/flows/:flowId/tasks/:taskId/github/sync` — Sync task to GitHub issue (requireAuth, requireRole member)

**`github.service.ts`** — Business logic:
- `verifyWebhookSignature(payload, signature, secret)` — HMAC-SHA256 verification
- `handleWebhook(event, payload)` — Route to handlers based on event type
- `handleInstallation(payload)` — Store/update/delete installation
- `handleIssues(payload)` — Sync issue state changes back to tasks
- `handleCheckRun(payload)` — Create evidence from check run results (test_result type)
- `handlePullRequest(payload)` — Create evidence from PR reviews (code_review type)
- `handleDeploymentStatus(payload)` — Create evidence from deployments (deployment type)
- `syncTaskToIssue(orgId, taskId, repoLinkId)` — Create GitHub issue from task, store link
- `syncIssueToTask(issueLink, issueData)` — Update task status from issue state
- `listInstallations(orgId)` — List installations
- `linkRepo(orgId, flowId, installationId, repoFullName)` — Create repo link
- `unlinkRepo(orgId, flowId, linkId)` — Remove repo link

**`github.client.ts`** — GitHub API client:
- Use `@octokit/rest` and `@octokit/auth-app` packages (add as dependencies)
- `getInstallationClient(installationId)` — Create authenticated Octokit for an installation
- `createIssue(client, owner, repo, title, body, labels)` — Create issue
- `updateIssue(client, owner, repo, issueNumber, update)` — Update issue
- `getRepos(installationId)` — List accessible repos for an installation

**Evidence auto-collection from webhooks:**
- `check_run.completed` → create evidence type `test_result` with data: `{tool, tests_passed, tests_failed, conclusion, url}`
- `pull_request_review.submitted` → create evidence type `code_review` with data: `{reviewer, state, url}`
- `deployment_status` → create evidence type `deployment` with data: `{environment, state, url}`

For each evidence created, link it to the flow via the repo link, and to a requirement if the PR/commit message contains `REQ-<requirement_id>`.

Register the github routes in `server.ts`.

### 3c. GitHub Schemas (in `packages/shared`)

Add Zod schemas: `linkRepoSchema`, `syncTaskSchema`. Add to exports.

### 3d. Frontend — GitHub Integration Settings

**`apps/web/src/pages/settings/integrations.tsx`:**
- Show list of GitHub installations for the org
- "Install GitHub App" button linking to GitHub App installation URL
- Installation callback handling (redirect back with installation_id)
- Per-installation: show linked repos, status

**`apps/web/src/pages/flows/detail.tsx`** — Add GitHub tab:
- Show linked repos for this flow
- "Link Repository" dialog (select from installation's accessible repos)
- Per-task: "Sync to GitHub" button
- Show GitHub-sourced evidence with links back to GitHub

---

## SECTION 4: Playwright E2E Tests

Install Playwright: `pnpm add -D @playwright/test --filter=@meridian/web`

Create `apps/web/playwright.config.ts`:
- baseURL: `http://localhost:5173`
- webServer: start API + web dev servers
- Use chromium only for speed

Create `apps/web/tests/e2e/`:

**`auth.spec.ts`:**
- Test login with valid credentials → redirects to dashboard
- Test login with invalid credentials → shows error
- Test register new account → creates org → redirects to dashboard
- Test logout → redirects to login

**`flows.spec.ts`:**
- Test create a new flow → appears in list
- Test flow detail page shows all tabs
- Test filter flows by stage
- Test search flows by title
- Test update flow title
- Test delete flow → disappears from list

**`lifecycle.spec.ts`:**
- Test full flow lifecycle: create flow at assess → generate assessment artifact → approve → transition to plan → generate PRD → approve → transition to build → transition to release
- Test gate blocks transition when policy not met
- Test readiness page shows gaps

**`traceability.spec.ts`:**
- Test create initiative → objective → requirement → task → evidence
- Test traceability graph shows all nodes
- Test gap detection shows requirement without task

**`rbac.spec.ts`:**
- Login as viewer → cannot create flows
- Login as member → can create flows and tasks
- Login as admin → can manage policies and approve artifacts

Add script to `apps/web/package.json`: `"test:e2e": "playwright test"`
Add to root: `"test:e2e": "pnpm --filter=@meridian/web test:e2e"`

Before writing tests, seed the UAT data by calling the API's seed endpoint or running the seed script.

---

## SECTION 5: WebSocket Real-Time Updates

### 5a. Backend WebSocket Support

Fastify already has `@fastify/websocket` as a dependency. Create `apps/api/src/infra/ws.ts`:

- Register WebSocket route at `/api/v1/ws`
- Authenticate via token query param: `/api/v1/ws?token=<jwt>`
- On connection: verify JWT, join org-specific room
- Expose `broadcast(orgId, event, data)` function
- Events to broadcast:
  - `flow.created`, `flow.updated`, `flow.stage_changed`, `flow.deleted`
  - `artifact.generated`, `artifact.approved`
  - `evidence.collected`
  - `task.updated`
  - `policy.evaluated`

Hook into the existing `eventBus` — subscribe to domain events and broadcast to connected org clients.

### 5b. Frontend WebSocket Hook

Create `apps/web/src/lib/ws.ts`:
- `useWebSocket()` hook that connects to `/api/v1/ws?token=<jwt>`
- Auto-reconnect on disconnect (exponential backoff)
- On message: invalidate relevant React Query caches
  - `flow.*` events → invalidate `['flows']` queries
  - `artifact.*` events → invalidate `['artifacts', flowId]`
  - `evidence.*` → invalidate `['evidence', flowId]`
  - `task.*` → invalidate `['tasks', flowId]`
- Show toast notification for key events (artifact approved, gate failed, etc.)

Wire up `useWebSocket()` in the `AppLayout` component so it's active for all authenticated pages.

---

## SECTION 6: Frontend Polish

### 6a. Loading States & Error Boundaries

Create `apps/web/src/components/ui/`:
- `spinner.tsx` — Animated loading spinner
- `skeleton.tsx` — Skeleton loader (rectangle, circle, text line variants)
- `error-boundary.tsx` — React error boundary with "Something went wrong" UI and retry button
- `empty-state.tsx` — Empty state component with icon, title, description, and CTA button

Apply to all pages:
- Flow list: skeleton cards while loading, empty state "No flows yet. Create your first delivery flow."
- Flow detail: skeleton tabs while loading
- Policies page: skeleton table, empty state "No policies configured."
- Dashboard: skeleton stat cards

### 6b. Dashboard Page Enhancement

Currently the dashboard is likely a placeholder. Make it useful:

- **Stat cards row:** Total flows, Active flows (in build/release), Flows with gaps, Pending approvals
- **Recent activity feed:** Last 10 events from the events table (show: actor, action, entity, timestamp)
- **Flows by stage chart:** Simple horizontal bar chart showing count per stage (use colored bars matching stage colors, no chart library needed — just styled divs)
- **Attention needed section:** Flows with failing evidence, flows blocked at gates, artifacts awaiting approval
- Fetch all data via React Query from existing API endpoints

### 6c. Flow Detail Page Enhancement

The flow detail page should have proper tabs (if not already):
- **Overview** — Flow info, stage timeline, counts
- **Requirements** — List with acceptance criteria, status badges, link to tasks
- **Tasks** — List/kanban with status, assignee, linked requirement
- **Artifacts** — List with type, status, version count, approve/reject buttons
- **Evidence** — List grouped by type with status badges and data preview
- **Traceability** — Visual graph (simplified: nested tree view showing Initiative → Objective → Requirement → Task → Evidence chain)
- **Readiness** — Readiness status, gaps list, policy evaluation results
- **GitHub** — Linked repos, synced issues, auto-collected evidence (from Section 3)

### 6d. Responsive Layout

- Sidebar collapses to icon-only on screens < 1024px
- Flow list switches from grid to single-column on mobile
- Tables become card-based on mobile
- Dialog/modals are full-screen on mobile

---

## SECTION 7: Audit Log Viewer

### 7a. Backend

The `events` table already stores audit events. Create an audit module:

**`apps/api/src/modules/audit/audit.routes.ts`:**
- `GET /api/v1/audit` — List audit events with filters (requireAuth)
  - Query params: `entity_type`, `event_type`, `actor_id`, `from_date`, `to_date`, `cursor`, `limit`
  - Returns paginated events with actor name joined

**`apps/api/src/modules/audit/audit.service.ts`:**
- `list(orgId, filters)` — Query events table with filtering and pagination

Register in `server.ts`.

### 7b. Frontend

**`apps/web/src/pages/audit/index.tsx`:**
- Table view of audit events
- Columns: Timestamp, Actor, Action, Entity, Details
- Filter bar: entity type dropdown, date range picker, actor search
- Infinite scroll or cursor-based pagination
- Click event to expand details JSON

Add "Audit Log" to the sidebar navigation (visible to admin+ only).

---

## SECTION 8: Advanced Artifact Types

Extend the AI artifact system to support additional types beyond `assessment` and `prd`:

### 8a. Backend — New Artifact Types

Update `packages/shared/src/constants.ts` to add artifact types:
```typescript
export const ARTIFACT_TYPES = ['assessment', 'prd', 'architecture', 'test_plan', 'runbook', 'release_notes'] as const;
```

Add new prompt templates in `apps/api/src/ai/prompts.ts` for each type:
- **architecture** — Generate system architecture document based on PRD and requirements. Sections: overview, components, data flow, technology choices, deployment topology, security considerations.
- **test_plan** — Generate test plan from requirements and acceptance criteria. Sections: scope, test strategy, test cases (linked to requirements), environments, exit criteria.
- **runbook** — Generate operational runbook. Sections: deployment steps, rollback procedure, monitoring checks, incident response, contacts.
- **release_notes** — Generate release notes from completed tasks, evidence, and artifacts. Sections: summary, features, fixes, known issues, migration steps.

Each prompt should include context: flow data, requirements, tasks, evidence, existing artifacts.

### 8b. Frontend — Artifact Type Selection

Update the "Generate Artifact" dialog to show all available types with descriptions. Disable types that don't make sense for the current stage (e.g., release_notes only available at release stage).

---

## SECTION 9: Notification System (In-App + Slack)

### 9a. In-App Notifications

**Migration `012_create_notifications.sql`:**
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at);
```

**Notification module (`apps/api/src/modules/notifications/`):**
- `GET /api/v1/notifications` — List user's notifications (requireAuth), paginated
- `GET /api/v1/notifications/unread-count` — Count of unread (requireAuth)
- `PATCH /api/v1/notifications/:id/read` — Mark as read (requireAuth)
- `POST /api/v1/notifications/read-all` — Mark all as read (requireAuth)

**Notification triggers** — Hook into eventBus:
- `artifact.approved` → Notify artifact creator
- `artifact.rejected` → Notify artifact creator
- `flow.stage_changed` → Notify flow owner and team members
- `evidence.collected` with status `failing` → Notify flow owner
- Gate failed on transition → Notify the user who attempted the transition

**Frontend — Notification bell:**
- Bell icon in the app header with unread count badge
- Dropdown panel showing recent notifications
- Click notification → navigate to relevant entity
- "Mark all as read" button
- Poll unread count every 30s (or use WebSocket from Section 5)

### 9b. Slack Integration

**Migration `013_create_slack_integrations.sql`:**
```sql
CREATE TABLE slack_integrations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  team_id TEXT, -- Slack team ID
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}', -- which events to send
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Slack module:**
- `POST /api/v1/slack/integrations` — Add Slack webhook (requireAuth, requireRole admin)
- `GET /api/v1/slack/integrations` — List integrations (requireAuth)
- `DELETE /api/v1/slack/integrations/:id` — Remove (requireAuth, requireRole admin)
- `POST /api/v1/slack/test` — Send test message (requireAuth, requireRole admin)

**Slack notification sender** — Hook into eventBus:
- Format messages as Slack Block Kit with context, action buttons
- Events: `flow.stage_changed`, `artifact.approved`, `evidence.collected` (failing), gate failures
- Send via webhook URL (simple `fetch` POST)

**Frontend — Slack settings page:**
- In settings, "Integrations" tab
- Add webhook URL, select channel name, select events to subscribe
- Test button to send a test message
- List existing integrations with delete option

---

## SECTION 10: Search & Analytics

### 10a. Full-Text Search

Add search endpoint that searches across all entities:

**`GET /api/v1/search?q=<query>&types=flow,requirement,task,artifact`**

- Search across: flow titles/descriptions, requirement titles, task titles, artifact content_text
- Use PostgreSQL `tsvector` and `to_tsquery` for full-text search
- Return results grouped by type with highlights
- Add GIN indexes on searchable columns

**Migration `014_create_search_indexes.sql`:**
```sql
ALTER TABLE flows ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;
CREATE INDEX idx_flows_search ON flows USING GIN(search_vector);

ALTER TABLE requirements ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;
CREATE INDEX idx_requirements_search ON requirements USING GIN(search_vector);

ALTER TABLE tasks ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;
CREATE INDEX idx_tasks_search ON tasks USING GIN(search_vector);
```

**Frontend — Global search:**
- Search input in the app header (Cmd+K shortcut to focus)
- Dropdown showing results grouped by type
- Click result → navigate to entity

### 10b. Analytics Dashboard

**`GET /api/v1/analytics/overview`** (requireAuth):
Returns:
```json
{
  "flows_by_stage": {"assess": 2, "plan": 1, "build": 3, ...},
  "flows_by_priority": {"critical": 1, "high": 3, ...},
  "evidence_by_type": {"test_result": 20, "security_scan": 5, ...},
  "evidence_by_status": {"passing": 18, "failing": 3, "pending": 4},
  "avg_time_per_stage_days": {"assess": 3.2, "plan": 5.1, ...},
  "flows_completed_last_30_days": 4,
  "policy_pass_rate": 0.85,
  "top_blockers": [{"policy_name": "...", "failure_count": 5}]
}
```

**Frontend — Analytics page (`/analytics`):**
- Stage distribution bar chart
- Evidence coverage donut chart
- Average time per stage chart
- Policy pass rate over time
- Top blocking policies table
- All using simple styled divs/CSS — no chart library

Add "Analytics" to sidebar navigation.

---

## EXECUTION RULES

1. **Read before writing.** Always read existing files before modifying them.
2. **Follow existing patterns.** Match the module structure, naming conventions, and code style already in the codebase.
3. **No breaking changes.** Existing 74 UAT tests must continue to pass after every section.
4. **Run tests after each section.** Verify with `pnpm uat` (start the API server first if needed).
5. **Commit after each section** with a descriptive message.
6. **Use existing dependencies** where possible. Only add new packages when necessary.
7. **Security:** Validate all webhook signatures. Never trust external input. Parameterize all SQL.
8. **snake_case** for DB columns and API fields. **camelCase** for TypeScript. **PascalCase** for types and components.
9. **Zod validation** on every new endpoint.
10. **Register all new routes** in `server.ts`.
11. **Export from barrel files** (`index.ts`) in shared packages.
12. **Keep the API server running** on port 3001 while testing. Docker Compose provides PostgreSQL and Redis.
