# Meridian — API Specification

## Overview

RESTful JSON API served by Fastify. All endpoints are prefixed with `/api/v1/`. Authentication via JWT Bearer token. All request/response bodies validated with Zod.

## Common Patterns

### Authentication

```
Authorization: Bearer <jwt_token>
```

All endpoints except `/api/v1/auth/*` require authentication.

### Pagination

List endpoints support cursor-based pagination:

```
GET /api/v1/flows?cursor=01HX...&limit=25
```

Response includes:

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "01HX...",
    "has_more": true
  }
}
```

### Filtering & Sorting

```
GET /api/v1/flows?status=active&stage=build&sort=-updated_at&limit=25
```

- Prefix sort field with `-` for descending
- Multiple filters are AND-ed

### Error Format (RFC 7807)

```json
{
  "type": "https://meridian.dev/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Flow title is required",
  "errors": [
    { "field": "title", "message": "Required", "code": "required" }
  ]
}
```

### Standard HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success (GET, PUT, PATCH) |
| 201 | Created (POST) |
| 202 | Accepted (async operations like AI generation) |
| 204 | No Content (DELETE) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden (valid auth, insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (optimistic locking, duplicate) |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Internal Server Error |

---

## Authentication Endpoints

### `POST /api/v1/auth/register`

Create a new account and organization.

**Request:**
```json
{
  "email": "alice@company.com",
  "password": "...",
  "name": "Alice Chen",
  "org_name": "Acme Corp"
}
```

**Response (201):**
```json
{
  "user": { "id": "usr_01HX...", "email": "alice@company.com", "name": "Alice Chen" },
  "org": { "id": "org_01HX...", "name": "Acme Corp", "slug": "acme-corp" },
  "access_token": "eyJ...",
  "refresh_token": "rt_01HX..."
}
```

### `POST /api/v1/auth/login`

**Request:**
```json
{
  "email": "alice@company.com",
  "password": "..."
}
```

**Response (200):**
```json
{
  "user": { "id": "usr_01HX...", "email": "alice@company.com", "name": "Alice Chen" },
  "org": { "id": "org_01HX...", "name": "Acme Corp", "slug": "acme-corp", "role": "owner" },
  "access_token": "eyJ...",
  "refresh_token": "rt_01HX..."
}
```

### `POST /api/v1/auth/refresh`

**Request:**
```json
{
  "refresh_token": "rt_01HX..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "rt_01HX..."
}
```

### `POST /api/v1/auth/logout`

Revokes the current refresh token.

**Response (204):** No content.

---

## Flow Endpoints

### `POST /api/v1/flows`

Create a new flow.

**Request:**
```json
{
  "title": "Payment API v2",
  "description": "Rebuild payment processing API with new provider",
  "priority": "high",
  "sensitivity": "high",
  "team_id": "team_01HX...",
  "tags": ["payments", "api"]
}
```

**Response (201):**
```json
{
  "id": "flow_01HX...",
  "title": "Payment API v2",
  "description": "Rebuild payment processing API with new provider",
  "current_stage": "assess",
  "status": "active",
  "priority": "high",
  "sensitivity": "high",
  "owner": { "id": "usr_01HX...", "name": "Alice Chen" },
  "team": { "id": "team_01HX...", "name": "Platform" },
  "tags": ["payments", "api"],
  "created_at": "2026-03-31T10:00:00Z",
  "updated_at": "2026-03-31T10:00:00Z"
}
```

### `GET /api/v1/flows`

List flows with filtering.

**Query params:** `status`, `stage`, `priority`, `team_id`, `owner_id`, `tag`, `search`, `sort`, `cursor`, `limit`

**Response (200):**
```json
{
  "data": [{ "id": "flow_01HX...", "..." : "..." }],
  "pagination": { "next_cursor": "...", "has_more": true }
}
```

### `GET /api/v1/flows/:flowId`

Get flow details including summary counts.

**Response (200):**
```json
{
  "id": "flow_01HX...",
  "title": "Payment API v2",
  "current_stage": "build",
  "status": "active",
  "priority": "high",
  "sensitivity": "high",
  "owner": { "id": "usr_01HX...", "name": "Alice Chen" },
  "team": { "id": "team_01HX...", "name": "Platform" },
  "tags": ["payments", "api"],
  "counts": {
    "initiatives": 1,
    "objectives": 3,
    "requirements": 12,
    "tasks": 24,
    "evidence": 18,
    "artifacts": 4
  },
  "stage_history": [
    { "from": null, "to": "assess", "at": "2026-03-31T10:00:00Z", "by": "Alice Chen" },
    { "from": "assess", "to": "plan", "at": "2026-03-31T14:00:00Z", "by": "Alice Chen" }
  ],
  "created_at": "2026-03-31T10:00:00Z",
  "updated_at": "2026-03-31T16:00:00Z"
}
```

### `PATCH /api/v1/flows/:flowId`

Update flow fields.

**Request:**
```json
{
  "title": "Payment API v2.1",
  "priority": "critical",
  "version": 1
}
```

**Response (200):** Updated flow object.

### `POST /api/v1/flows/:flowId/transition`

Advance or revert the flow stage. Triggers policy gate evaluation.

**Request:**
```json
{
  "to_stage": "plan",
  "reason": "Assessment approved by team lead"
}
```

**Response (200):**
```json
{
  "flow": { "..." : "..." },
  "gate_result": {
    "passed": true,
    "evaluations": [
      { "policy": "require-assessment", "result": "pass", "details": {} },
      { "policy": "sensitivity-review", "result": "pass", "details": {} }
    ]
  }
}
```

**Response (422) — gate failed:**
```json
{
  "type": "https://meridian.dev/errors/gate-failed",
  "title": "Policy Gate Failed",
  "status": 422,
  "detail": "1 blocking policy failed",
  "gate_result": {
    "passed": false,
    "evaluations": [
      { "policy": "require-assessment", "result": "fail", "details": { "message": "No approved assessment artifact found" } }
    ]
  }
}
```

### `DELETE /api/v1/flows/:flowId`

Soft-delete a flow.

**Response (204):** No content.

---

## Initiative / Objective / Requirement Endpoints

### Initiatives

```
POST   /api/v1/flows/:flowId/initiatives
GET    /api/v1/flows/:flowId/initiatives
GET    /api/v1/flows/:flowId/initiatives/:id
PATCH  /api/v1/flows/:flowId/initiatives/:id
DELETE /api/v1/flows/:flowId/initiatives/:id
```

**Create Request:**
```json
{
  "title": "Modernize payment processing",
  "description": "Replace legacy payment gateway with modern provider"
}
```

### Objectives

```
POST   /api/v1/initiatives/:initiativeId/objectives
GET    /api/v1/initiatives/:initiativeId/objectives
PATCH  /api/v1/objectives/:id
DELETE /api/v1/objectives/:id
```

**Create Request:**
```json
{
  "title": "Reduce payment processing latency",
  "description": "Process payments in under 500ms p99",
  "success_criteria": "p99 latency < 500ms measured over 7 days in production"
}
```

### Requirements

```
POST   /api/v1/objectives/:objectiveId/requirements
GET    /api/v1/flows/:flowId/requirements
GET    /api/v1/requirements/:id
PATCH  /api/v1/requirements/:id
DELETE /api/v1/requirements/:id
```

**Create Request:**
```json
{
  "title": "Implement async payment processing",
  "description": "Use event-driven architecture for payment flow",
  "type": "functional",
  "priority": "must",
  "acceptance_criteria": [
    { "description": "Payment completes within 500ms", "testable": true },
    { "description": "Failed payments retry up to 3 times", "testable": true }
  ]
}
```

---

## Task Endpoints

```
POST   /api/v1/flows/:flowId/tasks
GET    /api/v1/flows/:flowId/tasks
GET    /api/v1/tasks/:id
PATCH  /api/v1/tasks/:id
DELETE /api/v1/tasks/:id
```

**Create Request:**
```json
{
  "title": "Implement payment queue consumer",
  "description": "Build BullMQ consumer for processing payment events",
  "requirement_id": "req_01HX...",
  "assignee_id": "usr_01HX..."
}
```

**List Query Params:** `status`, `assignee_id`, `requirement_id`, `sort`, `cursor`, `limit`

---

## Artifact Endpoints

### `POST /api/v1/flows/:flowId/artifacts/generate`

Request AI generation of an artifact. Returns 202 with a job reference.

**Request:**
```json
{
  "type": "assessment",
  "context": {
    "additional_notes": "Focus on PCI-DSS implications"
  }
}
```

**Response (202):**
```json
{
  "job_id": "job_01HX...",
  "artifact_id": "art_01HX...",
  "status": "queued",
  "estimated_seconds": 15
}
```

### `GET /api/v1/jobs/:jobId`

Poll job status.

**Response (200):**
```json
{
  "id": "job_01HX...",
  "status": "completed",
  "result": {
    "artifact_id": "art_01HX...",
    "version": 1
  }
}
```

### `GET /api/v1/flows/:flowId/artifacts`

List artifacts for a flow.

### `GET /api/v1/artifacts/:id`

Get artifact with latest version content.

### `GET /api/v1/artifacts/:id/versions`

List all versions of an artifact.

### `GET /api/v1/artifacts/:id/versions/:version`

Get specific version content.

### `POST /api/v1/artifacts/:id/versions`

Create a new version manually (human edit).

**Request:**
```json
{
  "content": { "sections": [...] },
  "content_text": "# Assessment\n\n..."
}
```

### `POST /api/v1/artifacts/:id/approve`

Approve an artifact (requires `admin` or `owner` role).

**Response (200):**
```json
{
  "id": "art_01HX...",
  "status": "approved",
  "approved_by": { "id": "usr_01HX...", "name": "Alice Chen" },
  "approved_at": "2026-03-31T16:00:00Z"
}
```

### `POST /api/v1/artifacts/:id/regenerate`

Request a new AI-generated version based on feedback.

**Request:**
```json
{
  "feedback": "Add more detail on the security implications of storing card data"
}
```

**Response (202):** Same as generate response.

---

## Evidence Endpoints

```
POST   /api/v1/flows/:flowId/evidence
GET    /api/v1/flows/:flowId/evidence
GET    /api/v1/evidence/:id
DELETE /api/v1/evidence/:id
```

**Create Request (manual):**
```json
{
  "type": "manual",
  "source": "manual",
  "requirement_id": "req_01HX...",
  "data": {
    "description": "Manual security review completed by security team",
    "reviewer": "bob@company.com",
    "document_url": "https://notion.so/..."
  }
}
```

**Evidence is also created automatically** via GitHub webhooks (test results, PR reviews, deployments).

### `GET /api/v1/flows/:flowId/readiness`

Get release readiness report.

**Response (200):**
```json
{
  "flow_id": "flow_01HX...",
  "readiness": "not_ready",
  "summary": {
    "total_requirements": 12,
    "requirements_with_evidence": 10,
    "requirements_without_evidence": 2,
    "evidence_passing": 9,
    "evidence_failing": 1,
    "policy_gates_passed": 3,
    "policy_gates_failed": 1
  },
  "gaps": [
    { "requirement_id": "req_01HX...", "title": "Encryption at rest", "missing": ["test_result", "security_scan"] },
    { "requirement_id": "req_01HY...", "title": "Audit logging", "missing": ["test_result"] }
  ],
  "failing_evidence": [
    { "evidence_id": "evi_01HX...", "type": "security_scan", "status": "failing", "details": {...} }
  ],
  "gate_results": [
    { "policy": "test-coverage", "stage": "release", "result": "fail", "details": { "actual": 0.72, "required": 0.80 } }
  ]
}
```

---

## Policy Endpoints

```
POST   /api/v1/policies
GET    /api/v1/policies
GET    /api/v1/policies/:id
PATCH  /api/v1/policies/:id
DELETE /api/v1/policies/:id
```

**Create Request:**
```json
{
  "name": "require-security-scan",
  "description": "All HIGH sensitivity flows must have a passing security scan before release",
  "stage": "release",
  "severity": "blocking",
  "rules": {
    "when": { "flow.sensitivity": "high" },
    "require": {
      "evidence": { "type": "security_scan", "status": "passing" }
    }
  }
}
```

### `POST /api/v1/policies/evaluate`

Dry-run policy evaluation against a flow.

**Request:**
```json
{
  "flow_id": "flow_01HX...",
  "stage": "release"
}
```

**Response (200):**
```json
{
  "passed": false,
  "evaluations": [
    { "policy_id": "pol_01HX...", "name": "require-security-scan", "result": "fail", "severity": "blocking", "details": {...} },
    { "policy_id": "pol_01HY...", "name": "require-approval", "result": "pass", "severity": "blocking", "details": {...} }
  ]
}
```

---

## Graph / Traceability Endpoints

### `GET /api/v1/flows/:flowId/trace`

Full traceability tree for a flow.

**Response (200):**
```json
{
  "flow": { "id": "flow_01HX...", "title": "Payment API v2" },
  "initiatives": [
    {
      "id": "init_01HX...",
      "title": "Modernize payments",
      "objectives": [
        {
          "id": "obj_01HX...",
          "title": "Reduce latency",
          "requirements": [
            {
              "id": "req_01HX...",
              "title": "Async processing",
              "status": "implemented",
              "tasks": [
                {
                  "id": "task_01HX...",
                  "title": "Build queue consumer",
                  "status": "done",
                  "evidence": [
                    { "id": "evi_01HX...", "type": "test_result", "status": "passing" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### `GET /api/v1/flows/:flowId/impact?requirement_id=req_01HX...`

Impact analysis for a specific requirement.

### `GET /api/v1/flows/:flowId/gaps`

Requirements missing evidence or implementation.

---

## Organization Endpoints

```
GET    /api/v1/orgs/current
PATCH  /api/v1/orgs/current
GET    /api/v1/orgs/current/members
POST   /api/v1/orgs/current/members/invite
PATCH  /api/v1/orgs/current/members/:userId
DELETE /api/v1/orgs/current/members/:userId
```

## Team Endpoints

```
POST   /api/v1/teams
GET    /api/v1/teams
GET    /api/v1/teams/:id
PATCH  /api/v1/teams/:id
DELETE /api/v1/teams/:id
POST   /api/v1/teams/:id/members
DELETE /api/v1/teams/:id/members/:userId
```

---

## GitHub Integration Endpoints

### `POST /api/v1/integrations/github/install`

Begin GitHub App installation flow. Returns redirect URL.

### `GET /api/v1/integrations/github/callback`

Handle GitHub App installation callback.

### `POST /api/v1/integrations/github/webhooks`

Receive GitHub webhook events. Verified via webhook secret.

### `POST /api/v1/flows/:flowId/github/link`

Link a flow to a GitHub repository.

**Request:**
```json
{
  "repo_owner": "acme-corp",
  "repo_name": "payment-api",
  "sync_issues": true,
  "sync_prs": true
}
```

### `POST /api/v1/flows/:flowId/github/sync`

Trigger manual sync of issues/PRs from linked repos.

---

## WebSocket Events

Connect to `ws://host/api/v1/ws?token=<jwt>`.

### Server → Client Events

```json
{ "event": "flow.stage_changed",    "data": { "flow_id": "...", "to_stage": "build" } }
{ "event": "artifact.generated",     "data": { "artifact_id": "...", "type": "assessment" } }
{ "event": "evidence.collected",     "data": { "evidence_id": "...", "flow_id": "..." } }
{ "event": "gate.evaluated",         "data": { "flow_id": "...", "passed": false } }
{ "event": "task.status_changed",    "data": { "task_id": "...", "status": "done" } }
```

### Client → Server Events

```json
{ "action": "subscribe",   "channel": "flow:flow_01HX..." }
{ "action": "unsubscribe", "channel": "flow:flow_01HX..." }
```
