# Meridian — Authentication, Authorization & Multi-Tenancy

## Overview

Meridian is a multi-tenant SaaS application. Every user belongs to one or more organizations, and all data is strictly isolated per organization.

## Authentication

### Registration Flow

```
1. User submits email + password + name + org_name
2. Server validates input
3. Server creates User (password hashed with argon2id)
4. Server creates Org with slug derived from name
5. Server creates OrgMember (role: owner)
6. Server issues JWT access token (15min) + refresh token (7 days)
7. Client stores tokens
```

### Login Flow

```
1. User submits email + password
2. Server verifies password against argon2id hash
3. Server checks org membership
4. Server issues JWT + refresh token
5. Client stores tokens
```

### Token Architecture

**Access Token (JWT):**
- Short-lived: 15 minutes
- Signed with HS256 (symmetric, rotate via JWT_SECRET)
- Payload:

```json
{
  "sub": "usr_01HX...",
  "org_id": "org_01HX...",
  "role": "admin",
  "iat": 1711900000,
  "exp": 1711900900
}
```

**Refresh Token:**
- Long-lived: 7 days
- Stored in `refresh_tokens` table (hashed)
- One-time use: new refresh token issued on each refresh
- Revoked on password change or logout

```sql
CREATE TABLE refresh_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  org_id      TEXT NOT NULL REFERENCES orgs(id),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### API Keys

For programmatic access (CI/CD, integrations):

```
X-API-Key: mrd_01HX...
```

- Scoped to an organization
- Configurable permissions (read-only, write, admin)
- Key is shown once on creation, stored as argon2 hash
- Displayed prefix (`mrd_01HX...`) for identification

### Password Requirements

- Minimum 8 characters
- Hashed with argon2id (memory: 64MB, iterations: 3, parallelism: 1)
- Rate limited: 5 attempts per 15 minutes per email

## Authorization (RBAC)

### Roles

| Role | Description |
|------|-------------|
| **owner** | Full control. Can delete org, manage billing, transfer ownership. One per org. |
| **admin** | Manage members, policies, integrations. Approve artifacts. Cannot delete org. |
| **member** | Create and manage flows, tasks, evidence. Generate artifacts. Cannot manage policies or members. |
| **viewer** | Read-only access to all resources. Cannot create or modify anything. |

### Permission Matrix

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| **Org** |
| Update org settings | Yes | Yes | No | No |
| Delete org | Yes | No | No | No |
| Manage billing | Yes | No | No | No |
| **Members** |
| Invite members | Yes | Yes | No | No |
| Remove members | Yes | Yes | No | No |
| Change roles | Yes | Yes (not owner) | No | No |
| **Teams** |
| Create/edit teams | Yes | Yes | No | No |
| Manage team members | Yes | Yes | Lead only | No |
| **Flows** |
| Create flow | Yes | Yes | Yes | No |
| Edit flow | Yes | Yes | Owner/Team | No |
| Delete flow | Yes | Yes | Owner only | No |
| Transition stage | Yes | Yes | Owner/Team | No |
| **Artifacts** |
| Generate artifact | Yes | Yes | Yes | No |
| Edit artifact | Yes | Yes | Yes | No |
| Approve/reject artifact | Yes | Yes | No | No |
| **Policies** |
| Create/edit policies | Yes | Yes | No | No |
| Delete policies | Yes | Yes | No | No |
| View policies | Yes | Yes | Yes | Yes |
| **Evidence** |
| Submit evidence | Yes | Yes | Yes | No |
| View evidence | Yes | Yes | Yes | Yes |
| **Integrations** |
| Install/remove | Yes | Yes | No | No |
| Configure | Yes | Yes | No | No |

### Implementation

```typescript
// infra/auth/rbac.ts
const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

function requireRole(minimumRole: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userRole = req.user.role;
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minimumRole]) {
      throw new ForbiddenError(`Requires ${minimumRole} role or higher`);
    }
  };
}

// Additional permission checks (e.g., flow ownership)
function requireFlowAccess(action: 'read' | 'write' | 'admin') {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const flow = await flowRepo.findById(req.params.flowId, req.user.orgId);
    if (!flow) throw new NotFoundError('Flow');

    if (action === 'read') return; // all roles can read

    if (action === 'write') {
      if (req.user.role === 'viewer') throw new ForbiddenError();
      // Members can only edit flows they own or are on the team
      if (req.user.role === 'member') {
        const hasAccess = flow.owner_id === req.user.id ||
          await teamRepo.isMember(flow.team_id, req.user.id);
        if (!hasAccess) throw new ForbiddenError();
      }
    }

    if (action === 'admin') {
      if (ROLE_HIERARCHY[req.user.role] < ROLE_HIERARCHY['admin']) {
        throw new ForbiddenError();
      }
    }
  };
}
```

## Multi-Tenancy

### Isolation Strategy

**Row-Level Security (RLS)** at the PostgreSQL level ensures data isolation:

```sql
-- Enable RLS on every data table
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON flows
  USING (org_id = current_setting('app.current_org_id')::TEXT);

CREATE POLICY tenant_insert ON flows
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id')::TEXT);
```

**API middleware sets the tenant context:**

```typescript
// infra/auth/tenant.ts
app.addHook('preHandler', async (req) => {
  if (req.user) {
    // Set PostgreSQL session variable for RLS
    await req.db.query("SET LOCAL app.current_org_id = $1", [req.user.org_id]);
  }
});
```

**Benefits:**
- Impossible to access another org's data, even with SQL injection
- All queries are automatically scoped — no need to add `WHERE org_id = ?` manually
- Works with all query patterns including JOINs and subqueries

### Org Lifecycle

```
Create Org
    │
    ▼
Org Active ──── Add Members
    │            ├── owner (initial)
    │            ├── admin (invited)
    │            └── member (invited)
    │
    ▼
Org Settings
    ├── Branding (name, slug)
    ├── Defaults (sensitivity, priority)
    ├── AI (model preferences, token budget)
    ├── Security (password policy, session duration)
    └── Integrations (GitHub, Slack)
```

### Multi-Org Users (Future)

A user can belong to multiple orgs. On login, they select which org to use. Switching orgs issues a new JWT with the target `org_id`.

```
POST /api/v1/auth/switch-org
{ "org_id": "org_01HY..." }
→ { "access_token": "eyJ...", "refresh_token": "rt_01HX..." }
```

## Session Security

- Access tokens are not stored server-side (stateless JWT)
- Refresh tokens are stored hashed in the database
- All tokens are revoked on password change
- Concurrent session limit: 5 per user (configurable)
- Failed login lockout: 5 attempts per 15 minutes
- All auth events are logged to the `events` table

## Future: SSO (Enterprise)

Phase 4 will add:
- SAML 2.0 (for enterprise IdPs)
- OIDC (for Google Workspace, Okta, Auth0)
- SCIM provisioning (automatic user sync)
- JIT (Just-In-Time) provisioning on first SSO login
