# Meridian — Data Model

## Overview

Meridian uses a hybrid data model:
- **Relational (PostgreSQL)** — Source of truth for all entities, ACID transactions, referential integrity
- **Graph (Apache AGE)** — Projected from relational data for traceability queries, impact analysis, and gap detection

## Entity Relationship Diagram

```
┌──────────┐     ┌──────────┐     ┌─────────────┐     ┌──────────┐
│   Org    │────▶│  Team    │────▶│   Member    │◀────│   User   │
└──────────┘     └──────────┘     └─────────────┘     └──────────┘
     │
     │ owns
     ▼
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│   Flow   │────▶│  FlowStage   │────▶│   Artifact      │
└──────────┘     └──────────────┘     │  (versioned)    │
     │                                └─────────────────┘
     │ has
     ▼
┌──────────────┐     ┌──────────┐     ┌──────────────┐
│  Initiative  │────▶│Objective │────▶│ Requirement  │
└──────────────┘     └──────────┘     └──────────────┘
                                            │
                                            │ implemented by
                                            ▼
                                      ┌──────────┐     ┌──────────┐
                                      │   Task   │────▶│ Evidence │
                                      └──────────┘     └──────────┘
                                            │
                                            ▼
                                      ┌──────────────┐
                                      │  PolicyGate  │
                                      └──────────────┘
```

## Relational Schema

### Core Tables

#### `orgs`

```sql
CREATE TABLE orgs (
  id          TEXT PRIMARY KEY,          -- ulid
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,      -- URL-safe identifier
  plan        TEXT NOT NULL DEFAULT 'starter', -- starter, professional, enterprise
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
```

#### `users`

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,        -- ulid
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,           -- argon2
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
```

#### `org_members`

```sql
CREATE TABLE org_members (
  id       TEXT PRIMARY KEY,
  org_id   TEXT NOT NULL REFERENCES orgs(id),
  user_id  TEXT NOT NULL REFERENCES users(id),
  role     TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
```

#### `teams`

```sql
CREATE TABLE teams (
  id       TEXT PRIMARY KEY,
  org_id   TEXT NOT NULL REFERENCES orgs(id),
  name     TEXT NOT NULL,
  slug     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(org_id, slug)
);
```

#### `team_members`

```sql
CREATE TABLE team_members (
  id       TEXT PRIMARY KEY,
  team_id  TEXT NOT NULL REFERENCES teams(id),
  user_id  TEXT NOT NULL REFERENCES users(id),
  role     TEXT NOT NULL DEFAULT 'member', -- lead, member
  UNIQUE(team_id, user_id)
);
```

### Flow Tables

#### `flows`

The central entity. Represents a delivery unit moving through stages.

```sql
CREATE TABLE flows (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES orgs(id),
  title           TEXT NOT NULL,
  description     TEXT,
  current_stage   TEXT NOT NULL DEFAULT 'assess', -- assess, plan, build, release, done
  status          TEXT NOT NULL DEFAULT 'active',  -- active, paused, completed, cancelled
  priority        TEXT NOT NULL DEFAULT 'medium',  -- low, medium, high, critical
  sensitivity     TEXT NOT NULL DEFAULT 'low',     -- low, medium, high
  owner_id        TEXT REFERENCES users(id),
  team_id         TEXT REFERENCES teams(id),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_flows_org_id ON flows(org_id);
CREATE INDEX idx_flows_current_stage ON flows(org_id, current_stage);
CREATE INDEX idx_flows_status ON flows(org_id, status);
CREATE INDEX idx_flows_owner_id ON flows(owner_id);
CREATE INDEX idx_flows_team_id ON flows(team_id);
```

#### `flow_stage_transitions`

Audit trail of stage changes.

```sql
CREATE TABLE flow_stage_transitions (
  id          TEXT PRIMARY KEY,
  flow_id     TEXT NOT NULL REFERENCES flows(id),
  org_id      TEXT NOT NULL REFERENCES orgs(id),
  from_stage  TEXT,                      -- null for initial creation
  to_stage    TEXT NOT NULL,
  triggered_by TEXT NOT NULL REFERENCES users(id),
  reason      TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Traceability Tables

#### `initiatives`

Top-level strategic goals.

```sql
CREATE TABLE initiatives (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES orgs(id),
  flow_id     TEXT NOT NULL REFERENCES flows(id),
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
```

#### `objectives`

Measurable outcomes under an initiative.

```sql
CREATE TABLE objectives (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL REFERENCES orgs(id),
  initiative_id  TEXT NOT NULL REFERENCES initiatives(id),
  title          TEXT NOT NULL,
  description    TEXT,
  success_criteria TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
```

#### `requirements`

Specific requirements that fulfill objectives.

```sql
CREATE TABLE requirements (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES orgs(id),
  objective_id  TEXT NOT NULL REFERENCES objectives(id),
  flow_id       TEXT NOT NULL REFERENCES flows(id),
  title         TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL DEFAULT 'functional', -- functional, non_functional, security, compliance
  priority      TEXT NOT NULL DEFAULT 'must',       -- must, should, could, wont (MoSCoW)
  acceptance_criteria JSONB NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'draft',      -- draft, approved, implemented, verified
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_requirements_flow_id ON requirements(flow_id);
CREATE INDEX idx_requirements_objective_id ON requirements(objective_id);
```

#### `tasks`

Implementation work items.

```sql
CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES orgs(id),
  flow_id         TEXT NOT NULL REFERENCES flows(id),
  requirement_id  TEXT REFERENCES requirements(id),
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'todo', -- todo, in_progress, review, done
  assignee_id     TEXT REFERENCES users(id),
  external_ref    TEXT,                          -- e.g., github issue URL
  external_id     TEXT,                          -- e.g., github issue number
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_tasks_flow_id ON tasks(flow_id);
CREATE INDEX idx_tasks_requirement_id ON tasks(requirement_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
```

### Artifact Tables

#### `artifacts`

AI-generated or manually created documents attached to flows.

```sql
CREATE TABLE artifacts (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES orgs(id),
  flow_id     TEXT NOT NULL REFERENCES flows(id),
  type        TEXT NOT NULL, -- assessment, prd, architecture, test_plan, runbook, custom
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft', -- draft, review, approved, archived
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_artifacts_flow_id ON artifacts(flow_id);
CREATE INDEX idx_artifacts_type ON artifacts(org_id, type);
```

#### `artifact_versions`

Immutable versions of artifact content.

```sql
CREATE TABLE artifact_versions (
  id           TEXT PRIMARY KEY,
  artifact_id  TEXT NOT NULL REFERENCES artifacts(id),
  org_id       TEXT NOT NULL REFERENCES orgs(id),
  version      INTEGER NOT NULL,
  content      JSONB NOT NULL,           -- structured content (sections, etc.)
  content_text TEXT NOT NULL,            -- rendered markdown for display/search
  generated_by TEXT NOT NULL,            -- 'ai' or user_id
  prompt_hash  TEXT,                     -- hash of the prompt used (for AI generations)
  token_usage  JSONB,                   -- { input_tokens, output_tokens, model }
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(artifact_id, version)
);
```

### Evidence Tables

#### `evidence`

Proof that requirements are met.

```sql
CREATE TABLE evidence (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES orgs(id),
  flow_id         TEXT NOT NULL REFERENCES flows(id),
  requirement_id  TEXT REFERENCES requirements(id),
  type            TEXT NOT NULL, -- test_result, security_scan, code_review, approval, deployment, manual
  source          TEXT NOT NULL, -- github, gitlab, manual, ci_cd
  status          TEXT NOT NULL DEFAULT 'pending', -- pending, passing, failing, expired
  data            JSONB NOT NULL,          -- source-specific payload
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidence_flow_id ON evidence(flow_id);
CREATE INDEX idx_evidence_requirement_id ON evidence(requirement_id);
CREATE INDEX idx_evidence_type ON evidence(org_id, type);
```

### Policy Tables

#### `policies`

Reusable policy definitions.

```sql
CREATE TABLE policies (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES orgs(id),
  name        TEXT NOT NULL,
  description TEXT,
  stage       TEXT NOT NULL,             -- assess, plan, build, release (which gate)
  rules       JSONB NOT NULL,            -- parsed policy DSL rules
  severity    TEXT NOT NULL DEFAULT 'blocking', -- blocking, warning, info
  enabled     BOOLEAN NOT NULL DEFAULT true,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE(org_id, name)
);
```

#### `policy_evaluations`

Results of policy evaluation at gates.

```sql
CREATE TABLE policy_evaluations (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES orgs(id),
  flow_id     TEXT NOT NULL REFERENCES flows(id),
  policy_id   TEXT NOT NULL REFERENCES policies(id),
  stage       TEXT NOT NULL,
  result      TEXT NOT NULL,             -- pass, fail, warn, skip
  details     JSONB NOT NULL DEFAULT '{}', -- rule-by-rule results
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policy_evals_flow_id ON policy_evaluations(flow_id);
```

### Event & Audit Tables

#### `events`

Append-only event log for all domain events.

```sql
CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  entity_type TEXT NOT NULL,             -- flow, artifact, task, etc.
  entity_id   TEXT NOT NULL,
  event_type  TEXT NOT NULL,             -- flow.created, artifact.approved, etc.
  actor_id    TEXT,                       -- user who triggered, null for system
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_entity ON events(entity_type, entity_id);
CREATE INDEX idx_events_org_id ON events(org_id, created_at DESC);
CREATE INDEX idx_events_type ON events(event_type);
```

### Integration Tables

#### `github_installations`

```sql
CREATE TABLE github_installations (
  id                TEXT PRIMARY KEY,
  org_id            TEXT NOT NULL REFERENCES orgs(id),
  installation_id   BIGINT NOT NULL UNIQUE,
  account_login     TEXT NOT NULL,
  account_type      TEXT NOT NULL,        -- Organization, User
  permissions       JSONB NOT NULL DEFAULT '{}',
  repository_selection TEXT NOT NULL,     -- all, selected
  selected_repos    JSONB NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `github_repo_links`

Maps Meridian flows to GitHub repositories.

```sql
CREATE TABLE github_repo_links (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES orgs(id),
  flow_id       TEXT NOT NULL REFERENCES flows(id),
  installation_id TEXT NOT NULL REFERENCES github_installations(id),
  repo_owner    TEXT NOT NULL,
  repo_name     TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  sync_issues   BOOLEAN NOT NULL DEFAULT true,
  sync_prs      BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(flow_id, repo_owner, repo_name)
);
```

## Graph Schema (Apache AGE)

The graph is a **projection** of relational data, rebuilt from domain events.

### Node Types

```cypher
// Organization
(:Org {entity_id, name})

// Delivery Flow
(:Flow {entity_id, title, stage, status, priority, sensitivity})

// Traceability chain
(:Initiative {entity_id, title, status})
(:Objective {entity_id, title, status})
(:Requirement {entity_id, title, type, priority, status})
(:Task {entity_id, title, status})

// Artifacts & Evidence
(:Artifact {entity_id, type, title, status})
(:Evidence {entity_id, type, source, status})

// People
(:User {entity_id, name, email})
(:Team {entity_id, name})

// External
(:GitHubRepo {owner, name, url})
(:GitHubPR {number, title, status})
(:GitHubIssue {number, title, status})
```

### Edge Types

```cypher
// Organizational
(Org)-[:HAS_FLOW]->(Flow)
(Org)-[:HAS_TEAM]->(Team)
(Team)-[:HAS_MEMBER]->(User)
(User)-[:OWNS]->(Flow)

// Traceability chain (the core value prop)
(Flow)-[:HAS_INITIATIVE]->(Initiative)
(Initiative)-[:HAS_OBJECTIVE]->(Objective)
(Objective)-[:HAS_REQUIREMENT]->(Requirement)
(Requirement)-[:IMPLEMENTED_BY]->(Task)
(Task)-[:HAS_EVIDENCE]->(Evidence)

// Artifacts
(Flow)-[:HAS_ARTIFACT]->(Artifact)

// Cross-references
(Requirement)-[:DEPENDS_ON]->(Requirement)
(Flow)-[:DEPENDS_ON]->(Flow)
(Task)-[:BLOCKED_BY]->(Task)

// GitHub
(Flow)-[:LINKED_TO]->(GitHubRepo)
(Task)-[:TRACKED_IN]->(GitHubIssue)
(Task)-[:RESOLVED_BY]->(GitHubPR)

// Approvals
(User)-[:APPROVED]->(Artifact)
(User)-[:REVIEWED]->(Evidence)
```

### Key Graph Queries

#### Full Traceability (Initiative → Evidence)

```cypher
MATCH path = (i:Initiative)-[:HAS_OBJECTIVE]->(o:Objective)
  -[:HAS_REQUIREMENT]->(r:Requirement)
  -[:IMPLEMENTED_BY]->(t:Task)
  -[:HAS_EVIDENCE]->(e:Evidence)
WHERE i.entity_id = $initiativeId
RETURN path
```

#### Impact Analysis (What breaks if we change X?)

```cypher
MATCH (r:Requirement {entity_id: $reqId})
MATCH (r)<-[:HAS_REQUIREMENT]-(o:Objective)<-[:HAS_OBJECTIVE]-(i:Initiative)
MATCH (r)-[:IMPLEMENTED_BY]->(t:Task)
OPTIONAL MATCH (r)<-[:DEPENDS_ON]-(dependent:Requirement)
RETURN i, o, r, t, collect(dependent) as impacted
```

#### Gap Detection (Requirements without evidence)

```cypher
MATCH (f:Flow {entity_id: $flowId})-[:HAS_INITIATIVE]->(:Initiative)
  -[:HAS_OBJECTIVE]->(:Objective)-[:HAS_REQUIREMENT]->(r:Requirement)
WHERE NOT (r)-[:IMPLEMENTED_BY]->(:Task)-[:HAS_EVIDENCE]->(:Evidence)
RETURN r
```

#### Release Readiness

```cypher
MATCH (f:Flow {entity_id: $flowId})-[:HAS_INITIATIVE]->(:Initiative)
  -[:HAS_OBJECTIVE]->(:Objective)-[:HAS_REQUIREMENT]->(r:Requirement)
OPTIONAL MATCH (r)-[:IMPLEMENTED_BY]->(t:Task)-[:HAS_EVIDENCE]->(e:Evidence)
RETURN r.entity_id as requirement_id,
       r.title as requirement,
       r.status as req_status,
       collect(DISTINCT {task: t.entity_id, status: t.status}) as tasks,
       collect(DISTINCT {evidence: e.entity_id, type: e.type, status: e.status}) as evidence
```

## Row-Level Security

All tables with `org_id` use RLS:

```sql
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY flows_org_isolation ON flows
  USING (org_id = current_setting('app.current_org_id'));

CREATE POLICY flows_org_insert ON flows
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id'));
```

The API sets this on every request:

```sql
SET LOCAL app.current_org_id = 'org_01HX...';
```

## Migration Strategy

Migrations are managed with `node-pg-migrate`:

```
migrations/
├── 001_create_orgs.sql
├── 002_create_users.sql
├── 003_create_org_members.sql
├── 004_create_teams.sql
├── 005_create_flows.sql
├── 006_create_initiatives.sql
├── 007_create_objectives.sql
├── 008_create_requirements.sql
├── 009_create_tasks.sql
├── 010_create_artifacts.sql
├── 011_create_artifact_versions.sql
├── 012_create_evidence.sql
├── 013_create_policies.sql
├── 014_create_policy_evaluations.sql
├── 015_create_events.sql
├── 016_create_github_tables.sql
├── 017_enable_rls.sql
├── 018_init_age_graph.sql
```
