-- PAT-based GitHub connections (one per org)
CREATE TABLE IF NOT EXISTS github_connections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  display_name TEXT,
  token_scopes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_github_connections_org ON github_connections(org_id);

-- Allow repo links to reference a connection instead of (or in addition to) an installation
ALTER TABLE github_repo_links
  ADD COLUMN IF NOT EXISTS connection_id TEXT REFERENCES github_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ALTER COLUMN installation_id DROP NOT NULL;
