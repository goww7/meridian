import type {
  FlowStage, FlowStatus, Priority, Sensitivity, OrgRole, TeamRole,
  ArtifactType, ArtifactStatus, RequirementType, RequirementPriority,
  RequirementStatus, TaskStatus, EvidenceType, EvidenceSource,
  EvidenceStatus, PolicySeverity, PolicyEvalResult, ApprovalStatus,
  ApprovalWorkflowType, ComplianceFramework, ComplianceReportStatus,
  WebhookEventType, SsoProvider,
} from './constants.js';

// ─── Base ───
export interface Timestamps {
  created_at: string;
  updated_at: string;
}

// ─── Auth ───
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface JwtPayload {
  sub: string;
  org_id: string;
  role: OrgRole;
  iat: number;
  exp: number;
}

// ─── Org ───
export interface Org extends Timestamps {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: Record<string, unknown>;
}

// ─── User ───
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  org_id: string;
  role: OrgRole;
  joined_at: string;
  user?: User;
}

// ─── Team ───
export interface Team extends Timestamps {
  id: string;
  org_id: string;
  name: string;
  slug: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  user?: User;
}

// ─── Flow ───
export interface Flow extends Timestamps {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  current_stage: FlowStage;
  status: FlowStatus;
  priority: Priority;
  sensitivity: Sensitivity;
  owner_id: string | null;
  team_id: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  version: number;
  deleted_at: string | null;
}

export interface FlowDetail extends Flow {
  owner?: User | null;
  team?: Team | null;
  counts: {
    initiatives: number;
    objectives: number;
    requirements: number;
    tasks: number;
    evidence: number;
    artifacts: number;
  };
  stage_history: StageTransition[];
}

export interface StageTransition {
  id: string;
  flow_id: string;
  from_stage: FlowStage | null;
  to_stage: FlowStage;
  triggered_by: string;
  reason: string | null;
  created_at: string;
}

// ─── Initiative ───
export interface Initiative extends Timestamps {
  id: string;
  org_id: string;
  flow_id: string;
  title: string;
  description: string | null;
  status: string;
}

// ─── Objective ───
export interface Objective extends Timestamps {
  id: string;
  org_id: string;
  initiative_id: string;
  title: string;
  description: string | null;
  success_criteria: string | null;
  status: string;
}

// ─── Requirement ───
export interface AcceptanceCriterion {
  description: string;
  testable: boolean;
}

export interface Requirement extends Timestamps {
  id: string;
  org_id: string;
  flow_id: string;
  objective_id: string;
  title: string;
  description: string | null;
  type: RequirementType;
  priority: RequirementPriority;
  acceptance_criteria: AcceptanceCriterion[];
  status: RequirementStatus;
}

// ─── Task ───
export interface Task extends Timestamps {
  id: string;
  org_id: string;
  flow_id: string;
  requirement_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  external_ref: string | null;
  external_id: string | null;
  metadata: Record<string, unknown>;
}

// ─── Artifact ───
export interface ArtifactSection {
  id: string;
  title: string;
  content: string;
  subsections?: ArtifactSection[];
  [key: string]: unknown;
}

export interface ArtifactContent {
  sections: ArtifactSection[];
}

export interface Artifact extends Timestamps {
  id: string;
  org_id: string;
  flow_id: string;
  type: ArtifactType;
  title: string;
  status: ArtifactStatus;
  approved_by: string | null;
  approved_at: string | null;
  metadata: Record<string, unknown>;
}

export interface ArtifactVersion {
  id: string;
  artifact_id: string;
  org_id: string;
  version: number;
  content: ArtifactContent;
  content_text: string;
  generated_by: string;
  prompt_hash: string | null;
  token_usage: { input_tokens: number; output_tokens: number; model: string } | null;
  created_at: string;
}

// ─── Evidence ───
export interface Evidence {
  id: string;
  org_id: string;
  flow_id: string;
  requirement_id: string | null;
  type: EvidenceType;
  source: EvidenceSource;
  status: EvidenceStatus;
  data: Record<string, unknown>;
  collected_at: string;
  expires_at: string | null;
  created_at: string;
}

// ─── Policy ───
export interface PolicyRules {
  when?: Record<string, unknown>;
  require: Record<string, unknown>;
}

export interface Policy extends Timestamps {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  stage: FlowStage;
  rules: PolicyRules;
  severity: PolicySeverity;
  enabled: boolean;
  version: number;
}

export interface PolicyEvaluation {
  id: string;
  org_id: string;
  flow_id: string;
  policy_id: string;
  stage: FlowStage;
  result: PolicyEvalResult;
  details: Record<string, unknown>;
  evaluated_at: string;
}

export interface GateEvaluationResult {
  policy_id: string;
  policy_name: string;
  result: PolicyEvalResult;
  severity: PolicySeverity;
  details: { message: string; actual?: unknown; expected?: unknown };
}

export interface GateResult {
  passed: boolean;
  evaluations: GateEvaluationResult[];
  blocking_failures: GateEvaluationResult[];
  warnings: GateEvaluationResult[];
}

// ─── Events ───
export interface DomainEvent {
  id: string;
  org_id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

// ─── Pagination ───
export interface PaginationMeta {
  next_cursor: string | null;
  has_more: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ─── Readiness ───
export interface ReadinessReport {
  flow_id: string;
  readiness: 'ready' | 'not_ready';
  summary: {
    total_requirements: number;
    requirements_with_evidence: number;
    requirements_without_evidence: number;
    evidence_passing: number;
    evidence_failing: number;
  };
  gaps: Array<{ requirement_id: string; title: string; missing: string[] }>;
  failing_evidence: Evidence[];
  gate_results: GateEvaluationResult[];
}

// ─── Graph ───
export interface GraphNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface TraceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Jira ───
export interface JiraConnection extends Timestamps {
  id: string;
  org_id: string;
  site_url: string;
  site_name: string;
  webhook_secret: string | null;
  status: string;
}

export interface JiraProjectLink {
  id: string;
  org_id: string;
  flow_id: string;
  connection_id: string;
  project_key: string;
  project_name: string;
  sync_issues: boolean;
  import_completed: boolean;
  created_at: string;
}

export interface JiraIssueLink {
  id: string;
  entity_id: string;
  entity_type: 'task' | 'requirement' | 'initiative';
  project_link_id: string;
  issue_key: string;
  issue_type: string;
  issue_url: string;
  sync_direction: string;
  last_synced_at: string | null;
  created_at: string;
}

// ─── Confluence ───
export interface ConfluenceSpaceLink {
  id: string;
  org_id: string;
  flow_id: string;
  connection_id: string;
  space_key: string;
  space_name: string;
  parent_page_id: string | null;
  sync_direction: 'publish' | 'pull';
  created_at: string;
}

export interface ConfluencePageLink {
  id: string;
  org_id: string;
  artifact_id: string;
  space_link_id: string;
  page_id: string;
  page_title: string;
  page_url: string;
  sync_direction: 'publish' | 'pull';
  last_synced_at: string | null;
  last_synced_version: number | null;
  created_at: string;
}

// ─── LLM ───
export interface LlmConnection {
  id: string;
  org_id: string;
  provider: 'anthropic' | 'openai' | 'google';
  display_name: string;
  model: string;
  is_active: boolean;
  status: string;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Approval ───
export interface Approval extends Timestamps {
  id: string;
  org_id: string;
  entity_type: 'artifact' | 'flow';
  entity_id: string;
  flow_id: string;
  workflow_type: ApprovalWorkflowType;
  status: ApprovalStatus;
  required_approvers: number;
  current_approvals: number;
  requested_by: string;
  resolved_at: string | null;
}

export interface ApprovalResponse {
  id: string;
  approval_id: string;
  user_id: string;
  decision: 'approved' | 'rejected';
  comment: string | null;
  created_at: string;
  user?: User;
}

// ─── Compliance ───
export interface ComplianceReport extends Timestamps {
  id: string;
  org_id: string;
  framework: ComplianceFramework;
  title: string;
  status: ComplianceReportStatus;
  period_start: string;
  period_end: string;
  summary: ComplianceReportSummary | null;
  generated_by: string | null;
}

export interface ComplianceReportSummary {
  total_controls: number;
  controls_met: number;
  controls_partial: number;
  controls_unmet: number;
  evidence_count: number;
  policy_pass_rate: number;
  findings: ComplianceFinding[];
}

export interface ComplianceFinding {
  control_id: string;
  control_name: string;
  status: 'met' | 'partial' | 'unmet';
  evidence_refs: string[];
  gaps: string[];
}

// ─── API Key ───
export interface ApiKey {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
}

// ─── Outbound Webhook ───
export interface OutboundWebhook extends Timestamps {
  id: string;
  org_id: string;
  url: string;
  description: string | null;
  events: WebhookEventType[];
  secret: string | null;
  enabled: boolean;
  last_triggered_at: string | null;
  failure_count: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  response_body: string | null;
  success: boolean;
  attempted_at: string;
}

// ─── GitLab ───
export interface GitlabConnection extends Timestamps {
  id: string;
  org_id: string;
  instance_url: string;
  display_name: string;
  status: string;
}

export interface GitlabProjectLink {
  id: string;
  org_id: string;
  flow_id: string;
  connection_id: string;
  project_id: number;
  project_path: string;
  project_name: string;
  sync_mrs: boolean;
  sync_pipelines: boolean;
  created_at: string;
}

// ─── SSO ───
export interface SsoConfig extends Timestamps {
  id: string;
  org_id: string;
  provider: SsoProvider;
  display_name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  metadata_url: string | null;
}

// ─── Advanced Analytics ───
export interface AdvancedAnalytics {
  cycle_time: { avg_days: number; by_stage: Record<string, number> };
  lead_time: { avg_days: number; trend: number[] };
  approval_turnaround: { avg_hours: number; by_type: Record<string, number> };
  compliance_score: { current: number; trend: number[] };
  flow_velocity: { completed_per_week: number[]; trend: 'up' | 'down' | 'stable' };
}

// ─── Job ───
export interface JobStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: { artifact_id: string; version: number };
  error?: string;
  progress?: number;
}
