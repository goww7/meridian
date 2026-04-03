-- GitLab integration
CREATE TABLE gitlab_connections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  instance_url TEXT NOT NULL,
  display_name TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  webhook_secret TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gitlab_connections_org ON gitlab_connections(org_id);

-- GitLab project links
CREATE TABLE gitlab_project_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES gitlab_connections(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  project_path TEXT NOT NULL,
  project_name TEXT NOT NULL,
  sync_mrs BOOLEAN NOT NULL DEFAULT true,
  sync_pipelines BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gitlab_project_links_org ON gitlab_project_links(org_id);
CREATE INDEX idx_gitlab_project_links_flow ON gitlab_project_links(flow_id);
CREATE UNIQUE INDEX idx_gitlab_project_links_unique ON gitlab_project_links(flow_id, connection_id, project_id);

-- GitLab MR/pipeline evidence links
CREATE TABLE gitlab_evidence_links (
  id TEXT PRIMARY KEY,
  project_link_id TEXT NOT NULL REFERENCES gitlab_project_links(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  gitlab_ref_type TEXT NOT NULL CHECK (gitlab_ref_type IN ('merge_request', 'pipeline', 'deployment')),
  gitlab_ref_id TEXT NOT NULL,
  gitlab_ref_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gitlab_evidence_links_project ON gitlab_evidence_links(project_link_id);
