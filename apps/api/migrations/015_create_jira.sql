-- Jira Integration tables

CREATE TABLE IF NOT EXISTS jira_connections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  site_url TEXT NOT NULL,
  site_name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  webhook_secret TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jira_connections_org ON jira_connections(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jira_connections_org_site ON jira_connections(org_id, site_url) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS jira_project_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  flow_id TEXT NOT NULL REFERENCES flows(id),
  connection_id TEXT NOT NULL REFERENCES jira_connections(id),
  project_key TEXT NOT NULL,
  project_name TEXT NOT NULL,
  sync_issues BOOLEAN NOT NULL DEFAULT true,
  import_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(flow_id, connection_id, project_key)
);

CREATE INDEX IF NOT EXISTS idx_jira_project_links_org ON jira_project_links(org_id);
CREATE INDEX IF NOT EXISTS idx_jira_project_links_flow ON jira_project_links(flow_id);

CREATE TABLE IF NOT EXISTS jira_issue_links (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  project_link_id TEXT NOT NULL REFERENCES jira_project_links(id),
  issue_key TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  issue_url TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'inbound',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jira_issue_links_entity ON jira_issue_links(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_jira_issue_links_issue_key ON jira_issue_links(issue_key);
CREATE INDEX IF NOT EXISTS idx_jira_issue_links_project ON jira_issue_links(project_link_id);
