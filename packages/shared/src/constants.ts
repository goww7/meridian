export const FLOW_STAGES = ['assess', 'plan', 'build', 'release', 'done'] as const;
export type FlowStage = (typeof FLOW_STAGES)[number];

export const FLOW_STATUSES = ['active', 'paused', 'completed', 'cancelled'] as const;
export type FlowStatus = (typeof FLOW_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SENSITIVITIES = ['low', 'medium', 'high'] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

export const ORG_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const TEAM_ROLES = ['lead', 'member'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const ARTIFACT_TYPES = ['assessment', 'prd', 'architecture', 'test_plan', 'runbook', 'release_notes', 'custom'] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_STATUSES = ['draft', 'review', 'approved', 'archived'] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

export const REQUIREMENT_TYPES = ['functional', 'non_functional', 'security', 'compliance'] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const REQUIREMENT_PRIORITIES = ['must', 'should', 'could', 'wont'] as const;
export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number];

export const REQUIREMENT_STATUSES = ['draft', 'approved', 'implemented', 'verified'] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EVIDENCE_TYPES = ['test_result', 'security_scan', 'code_review', 'approval', 'deployment', 'manual'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_SOURCES = ['github', 'gitlab', 'manual', 'ci_cd'] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export const EVIDENCE_STATUSES = ['pending', 'passing', 'failing', 'expired'] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const POLICY_SEVERITIES = ['blocking', 'warning', 'info'] as const;
export type PolicySeverity = (typeof POLICY_SEVERITIES)[number];

export const POLICY_EVAL_RESULTS = ['pass', 'fail', 'warn', 'skip'] as const;
export type PolicyEvalResult = (typeof POLICY_EVAL_RESULTS)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_WORKFLOW_TYPES = ['sequential', 'parallel', 'any'] as const;
export type ApprovalWorkflowType = (typeof APPROVAL_WORKFLOW_TYPES)[number];

export const COMPLIANCE_FRAMEWORKS = ['soc2', 'iso27001', 'hipaa', 'pci_dss'] as const;
export type ComplianceFramework = (typeof COMPLIANCE_FRAMEWORKS)[number];

export const COMPLIANCE_REPORT_STATUSES = ['draft', 'generating', 'complete', 'expired'] as const;
export type ComplianceReportStatus = (typeof COMPLIANCE_REPORT_STATUSES)[number];

export const WEBHOOK_EVENT_TYPES = [
  'flow.created', 'flow.updated', 'flow.stage_changed',
  'artifact.generated', 'artifact.approved',
  'evidence.collected', 'task.updated',
  'policy.evaluated', 'approval.requested', 'approval.granted', 'approval.rejected',
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const SSO_PROVIDERS = ['saml', 'oidc'] as const;
export type SsoProvider = (typeof SSO_PROVIDERS)[number];

export const STAGE_ORDER: Record<FlowStage, number> = {
  assess: 0,
  plan: 1,
  build: 2,
  release: 3,
  done: 4,
};

export const VALID_TRANSITIONS: Record<FlowStage, FlowStage[]> = {
  assess: ['plan'],
  plan: ['build', 'assess'],
  build: ['release', 'plan'],
  release: ['done', 'build'],
  done: [],
};
