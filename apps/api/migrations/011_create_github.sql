-- Add missing columns to github_installations
ALTER TABLE github_installations
  ADD COLUMN IF NOT EXISTS app_id INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS events JSONB NOT NULL DEFAULT '[]';

-- Add missing column to github_repo_links
ALTER TABLE github_repo_links
  ADD COLUMN IF NOT EXISTS repo_full_name TEXT;

-- Backfill repo_full_name from existing data
UPDATE github_repo_links SET repo_full_name = repo_owner || '/' || repo_name WHERE repo_full_name IS NULL;

ALTER TABLE github_repo_links
  ALTER COLUMN repo_full_name SET NOT NULL;

-- Create indexes if not present
CREATE INDEX IF NOT EXISTS idx_github_installations_org ON github_installations(org_id);
CREATE INDEX IF NOT EXISTS idx_github_repo_links_flow ON github_repo_links(flow_id);

-- Add unique constraint on (flow_id, repo_full_name) if not present
-- (010 had UNIQUE(flow_id, repo_owner, repo_name) so this adds the new style)
CREATE UNIQUE INDEX IF NOT EXISTS idx_github_repo_links_flow_repo ON github_repo_links(flow_id, repo_full_name);

-- Create github_issue_links table
CREATE TABLE IF NOT EXISTS github_issue_links (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  repo_link_id TEXT NOT NULL REFERENCES github_repo_links(id) ON DELETE CASCADE,
  issue_number INTEGER NOT NULL,
  issue_url TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_github_issue_links_task ON github_issue_links(task_id);
