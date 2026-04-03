-- Compliance reports for SOC 2, ISO 27001, HIPAA, PCI-DSS
CREATE TABLE compliance_reports (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  framework TEXT NOT NULL CHECK (framework IN ('soc2', 'iso27001', 'hipaa', 'pci_dss')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'complete', 'expired')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  summary JSONB,
  report_data JSONB,
  generated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_reports_org ON compliance_reports(org_id);
CREATE INDEX idx_compliance_reports_framework ON compliance_reports(org_id, framework);

-- Compliance controls mapped to evidence
CREATE TABLE compliance_controls (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  framework TEXT NOT NULL,
  control_id TEXT NOT NULL,
  control_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_compliance_controls_unique ON compliance_controls(org_id, framework, control_id);

-- Map controls to evidence types
CREATE TABLE compliance_control_mappings (
  id TEXT PRIMARY KEY,
  control_ref TEXT NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  policy_id TEXT REFERENCES policies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_mappings_control ON compliance_control_mappings(control_ref);
