-- Approval workflows for artifacts and flows
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('artifact', 'flow')),
  entity_id TEXT NOT NULL,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL DEFAULT 'parallel' CHECK (workflow_type IN ('sequential', 'parallel', 'any')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  required_approvers INTEGER NOT NULL DEFAULT 1,
  current_approvals INTEGER NOT NULL DEFAULT 0,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approvals_org ON approvals(org_id);
CREATE INDEX idx_approvals_entity ON approvals(entity_type, entity_id);
CREATE INDEX idx_approvals_flow ON approvals(flow_id);
CREATE INDEX idx_approvals_status ON approvals(org_id, status);

-- Individual approval responses from approvers
CREATE TABLE approval_responses (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  comment TEXT,
  seq_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_responses_approval ON approval_responses(approval_id);
CREATE UNIQUE INDEX idx_approval_responses_unique ON approval_responses(approval_id, user_id);

-- Track which users are designated approvers for each approval
CREATE TABLE approval_assignees (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seq_order INTEGER NOT NULL DEFAULT 0,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_assignees_approval ON approval_assignees(approval_id);
CREATE UNIQUE INDEX idx_approval_assignees_unique ON approval_assignees(approval_id, user_id);
