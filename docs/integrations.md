# Meridian — Integrations

## Overview

Meridian integrates with external tools to sync work items, collect evidence, and provide notifications. The primary integration is GitHub; additional integrations (Slack, Jira, GitLab) are planned for later phases.

## GitHub Integration

### Architecture

Meridian connects to GitHub as a **GitHub App** (not OAuth). This provides:

- Fine-grained repository permissions
- Webhook events for real-time sync
- Installation-level access tokens (no user tokens needed for background sync)
- Organization-wide installation

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Meridian   │────▶│   GitHub App     │────▶│   GitHub     │
│   API        │     │   (installed)    │     │   API        │
└──────────────┘     └──────────────────┘     └──────┬───────┘
       ▲                                             │
       │              Webhooks                       │
       └─────────────────────────────────────────────┘
```

### Setup Flow

1. **Admin installs GitHub App** from Meridian settings page
2. Meridian redirects to GitHub App installation page
3. Admin selects org and repositories
4. GitHub redirects back with `installation_id`
5. Meridian stores installation and fetches available repos
6. Admin links specific repos to flows

### GitHub App Permissions

```yaml
permissions:
  contents: read          # Read repo contents
  issues: write           # Create/update issues from tasks
  pull_requests: write    # Read PR status, create check runs
  checks: write           # Report Meridian check status on PRs
  deployments: read       # Track deployments as evidence
  metadata: read          # Read repo metadata

events:
  - push
  - pull_request
  - pull_request_review
  - check_run
  - check_suite
  - deployment
  - deployment_status
  - issues
  - issue_comment
```

### Bidirectional Sync

#### Meridian → GitHub

| Meridian Entity | GitHub Entity | Sync Behavior |
|----------------|---------------|---------------|
| Task (created) | Issue (created) | Creates GitHub issue with title, description, labels |
| Task (status changed) | Issue (updated) | Updates issue state (open/closed) |
| Task (assigned) | Issue (assigned) | Assigns GitHub user |
| Flow (stage changed) | Label (added) | Adds stage label to linked issues |

#### GitHub → Meridian

| GitHub Event | Meridian Action |
|-------------|----------------|
| Issue closed | Task status → `done` |
| Issue reopened | Task status → `in_progress` |
| PR opened (refs task) | Task status → `review`, link PR |
| PR merged | Task status → `done`, collect evidence |
| PR review (approved) | Collect code review evidence |
| Check run completed | Collect CI/CD evidence |
| Deployment status | Collect deployment evidence |

### Evidence Collection from GitHub

#### Test Results (from Check Runs)

When a check run completes (e.g., CI test suite):

```json
{
  "type": "test_result",
  "source": "github",
  "status": "passing",
  "data": {
    "check_run_id": 12345,
    "name": "Test Suite",
    "conclusion": "success",
    "output": {
      "title": "142 tests passed",
      "summary": "Coverage: 87%"
    },
    "html_url": "https://github.com/acme/api/actions/runs/12345",
    "started_at": "2026-03-31T10:00:00Z",
    "completed_at": "2026-03-31T10:05:00Z"
  }
}
```

#### Code Review Evidence (from PR Reviews)

When a PR linked to a task receives an approving review:

```json
{
  "type": "code_review",
  "source": "github",
  "status": "passing",
  "data": {
    "pr_number": 42,
    "pr_title": "Implement AES-256 encryption",
    "reviewer": "bob",
    "review_state": "approved",
    "html_url": "https://github.com/acme/api/pull/42#pullrequestreview-12345"
  }
}
```

#### Deployment Evidence

When a deployment status event is received:

```json
{
  "type": "deployment",
  "source": "github",
  "status": "passing",
  "data": {
    "environment": "production",
    "state": "success",
    "sha": "abc123",
    "html_url": "https://github.com/acme/api/deployments/12345"
  }
}
```

### Webhook Handling

```typescript
// integrations/github/webhook-handler.ts
async function handleGitHubWebhook(event: string, payload: any) {
  // 1. Verify webhook signature (HMAC SHA-256)
  // 2. Find installation in our DB
  // 3. Route to handler by event type

  switch (event) {
    case 'pull_request':
      return handlePullRequest(payload);
    case 'pull_request_review':
      return handlePullRequestReview(payload);
    case 'check_run':
      return handleCheckRun(payload);
    case 'deployment_status':
      return handleDeploymentStatus(payload);
    case 'issues':
      return handleIssueEvent(payload);
    case 'installation':
      return handleInstallation(payload);
  }
}
```

### Task ↔ Issue Linking

Tasks are linked to GitHub issues via:

1. **Auto-link on task creation:** When a task is created in a flow with a linked repo, a GitHub issue is created automatically (if `sync_issues` is enabled).

2. **Manual link:** User links an existing GitHub issue to a task via the API.

3. **Reference detection:** When a PR body or commit message contains `MRD-<task_id>`, the system links the PR to that task.

### Meridian Check Run

Meridian creates its own GitHub Check Run on PRs to show:

- Flow stage and status
- Linked requirements coverage
- Policy gate evaluation preview

```
✅ Meridian — Payment API v2
   Stage: build | 3/4 requirements covered | Release gate: 2 warnings
```

---

## CI/CD Webhook (Generic)

For CI/CD systems without dedicated integrations, Meridian exposes a generic webhook endpoint.

### `POST /api/v1/webhooks/ci`

**Headers:**
```
Content-Type: application/json
X-Meridian-Signature: sha256=<hmac>
```

**Request:**
```json
{
  "flow_id": "flow_01HX...",
  "type": "test_result",
  "status": "passing",
  "data": {
    "tool": "jest",
    "tests_passed": 142,
    "tests_failed": 0,
    "coverage": 0.87,
    "duration_ms": 34000,
    "ci_url": "https://ci.example.com/builds/12345"
  }
}
```

**Signature verification:**

```typescript
const expected = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(body))
  .digest('hex');

if (signature !== `sha256=${expected}`) {
  throw new Error('Invalid signature');
}
```

### CI Integration Examples

**GitHub Actions:**

```yaml
# .github/workflows/test.yml
- name: Report to Meridian
  if: always()
  run: |
    curl -X POST "$MERIDIAN_URL/api/v1/webhooks/ci" \
      -H "Content-Type: application/json" \
      -H "X-Meridian-Signature: sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$MERIDIAN_WEBHOOK_SECRET" | cut -d' ' -f2)" \
      -d "$BODY"
  env:
    BODY: |
      {
        "flow_id": "${{ env.MERIDIAN_FLOW_ID }}",
        "type": "test_result",
        "status": "${{ steps.test.outcome == 'success' && 'passing' || 'failing' }}",
        "data": {
          "ci_url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
        }
      }
```

---

## Slack Integration (Phase 2)

### Planned Features

- **Notifications** — Flow stage changes, gate failures, approvals needed
- **Slash commands** — `/meridian status <flow>`, `/meridian approve <artifact>`
- **Approval flow** — Approve/reject artifacts directly from Slack
- **Daily digest** — Summary of flow progress per team channel

### Notification Templates

```
🔄 *Flow stage changed*
*Payment API v2* moved from `plan` → `build`
By: Alice Chen | 3 requirements ready

⛔ *Gate failed*
*Payment API v2* blocked at `release` gate
Failed: require-security-scan (blocking)
<View details|https://app.meridian.dev/flows/flow_01HX...>

✅ *Artifact approved*
*Assessment* for Payment API v2 was approved
By: Bob Smith
```

---

## Jira Import (Phase 2)

### Planned Features

- One-way import of Jira issues as tasks
- Map Jira epics → Meridian initiatives
- Map Jira stories → Meridian requirements
- Map Jira subtasks → Meridian tasks
- Preserve status and assignee mappings

---

## Integration Framework

All integrations follow a common adapter pattern:

```typescript
// integrations/types.ts
interface IntegrationAdapter {
  id: string;
  name: string;

  // Lifecycle
  install(orgId: string, config: any): Promise<void>;
  uninstall(orgId: string): Promise<void>;

  // Outbound
  syncTask(task: Task, action: 'create' | 'update' | 'delete'): Promise<void>;
  syncFlow(flow: Flow, action: 'stage_changed'): Promise<void>;

  // Inbound
  handleWebhook(event: string, payload: any): Promise<void>;

  // Evidence
  collectEvidence(flowId: string): Promise<Evidence[]>;
}
```

This pattern makes it straightforward to add new integrations by implementing the adapter interface.
