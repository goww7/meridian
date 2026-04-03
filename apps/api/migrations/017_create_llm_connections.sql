-- LLM Provider connections (per-org API key management)

CREATE TABLE IF NOT EXISTS llm_connections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_connections_org ON llm_connections(org_id);
-- Only one active connection per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_connections_active ON llm_connections(org_id) WHERE is_active = true AND status = 'active';
