CREATE TABLE slack_integrations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  team_id TEXT,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slack_org ON slack_integrations(org_id);
