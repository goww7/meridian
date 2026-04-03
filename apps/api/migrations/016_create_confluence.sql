-- Confluence Integration tables
-- Reuses jira_connections for Atlassian OAuth (same token works for both APIs)

CREATE TABLE IF NOT EXISTS confluence_space_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  flow_id TEXT NOT NULL REFERENCES flows(id),
  connection_id TEXT NOT NULL REFERENCES jira_connections(id),
  space_key TEXT NOT NULL,
  space_name TEXT NOT NULL,
  parent_page_id TEXT,
  sync_direction TEXT NOT NULL DEFAULT 'publish',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(flow_id, connection_id, space_key)
);

CREATE INDEX IF NOT EXISTS idx_confluence_space_links_org ON confluence_space_links(org_id);
CREATE INDEX IF NOT EXISTS idx_confluence_space_links_flow ON confluence_space_links(flow_id);

CREATE TABLE IF NOT EXISTS confluence_page_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  space_link_id TEXT NOT NULL REFERENCES confluence_space_links(id),
  page_id TEXT NOT NULL,
  page_title TEXT NOT NULL,
  page_url TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'publish',
  last_synced_at TIMESTAMPTZ,
  last_synced_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(artifact_id, space_link_id)
);

CREATE INDEX IF NOT EXISTS idx_confluence_page_links_org ON confluence_page_links(org_id);
CREATE INDEX IF NOT EXISTS idx_confluence_page_links_artifact ON confluence_page_links(artifact_id);
CREATE INDEX IF NOT EXISTS idx_confluence_page_links_page ON confluence_page_links(page_id);
