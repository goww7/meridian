-- SSO configurations
CREATE TABLE sso_configs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('saml', 'oidc')),
  display_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  metadata_url TEXT,
  entity_id TEXT,
  acs_url TEXT,
  certificate TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sso_configs_org ON sso_configs(org_id);
CREATE UNIQUE INDEX idx_sso_configs_unique ON sso_configs(org_id, provider);
