import { z } from 'zod';
import {
  FLOW_STAGES, FLOW_STATUSES, PRIORITIES, SENSITIVITIES,
  ORG_ROLES, TEAM_ROLES, ARTIFACT_TYPES, ARTIFACT_STATUSES,
  REQUIREMENT_TYPES, REQUIREMENT_PRIORITIES, REQUIREMENT_STATUSES,
  TASK_STATUSES, EVIDENCE_TYPES, EVIDENCE_SOURCES, EVIDENCE_STATUSES,
  POLICY_SEVERITIES, APPROVAL_WORKFLOW_TYPES, COMPLIANCE_FRAMEWORKS,
  WEBHOOK_EVENT_TYPES, SSO_PROVIDERS,
} from './constants.js';

// ─── Auth ───
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
  org_name: z.string().min(1).max(200),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

// ─── Org ───
export const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_ROLES).default('member'),
});

export const updateMemberSchema = z.object({
  role: z.enum(ORG_ROLES),
});

// ─── Team ───
export const createTeamSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export const addTeamMemberSchema = z.object({
  user_id: z.string().min(1),
  role: z.enum(TEAM_ROLES).default('member'),
});

// ─── Flow ───
export const createFlowSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(PRIORITIES).default('medium'),
  sensitivity: z.enum(SENSITIVITIES).default('low'),
  team_id: z.string().optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
});
export type CreateFlowInput = z.infer<typeof createFlowSchema>;

export const updateFlowSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  sensitivity: z.enum(SENSITIVITIES).optional(),
  owner_id: z.string().nullable().optional(),
  team_id: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  status: z.enum(FLOW_STATUSES).optional(),
  version: z.number().int().positive(),
});
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;

export const transitionFlowSchema = z.object({
  to_stage: z.enum(FLOW_STAGES),
  reason: z.string().max(1000).optional(),
});
export type TransitionFlowInput = z.infer<typeof transitionFlowSchema>;

export const listFlowsSchema = z.object({
  status: z.enum(FLOW_STATUSES).optional(),
  stage: z.enum(FLOW_STAGES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  team_id: z.string().optional(),
  owner_id: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().max(200).optional(),
  sort: z.string().default('-updated_at'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// ─── Initiative ───
export const createInitiativeSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
});

// ─── Objective ───
export const createObjectiveSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  success_criteria: z.string().max(2000).optional(),
});

// ─── Requirement ───
export const acceptanceCriterionSchema = z.object({
  description: z.string().min(1).max(1000),
  testable: z.boolean().default(true),
});

export const createRequirementSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  objective_id: z.string().min(1),
  type: z.enum(REQUIREMENT_TYPES).default('functional'),
  priority: z.enum(REQUIREMENT_PRIORITIES).default('must'),
  acceptance_criteria: z.array(acceptanceCriterionSchema).default([]),
});
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;

export const updateRequirementSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  type: z.enum(REQUIREMENT_TYPES).optional(),
  priority: z.enum(REQUIREMENT_PRIORITIES).optional(),
  acceptance_criteria: z.array(acceptanceCriterionSchema).optional(),
  status: z.enum(REQUIREMENT_STATUSES).optional(),
});

// ─── Task ───
export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  requirement_id: z.string().optional(),
  assignee_id: z.string().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assignee_id: z.string().nullable().optional(),
  requirement_id: z.string().nullable().optional(),
});

// ─── Artifact ───
export const generateArtifactSchema = z.object({
  type: z.enum(ARTIFACT_TYPES),
  context: z.record(z.unknown()).default({}),
});
export type GenerateArtifactInput = z.infer<typeof generateArtifactSchema>;

export const createArtifactVersionSchema = z.object({
  content: z.object({ sections: z.array(z.record(z.unknown())) }),
  content_text: z.string(),
});

export const regenerateArtifactSchema = z.object({
  feedback: z.string().min(1).max(5000),
});

// ─── Evidence ───
export const createEvidenceSchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  source: z.enum(EVIDENCE_SOURCES).default('manual'),
  requirement_id: z.string().optional(),
  status: z.enum(EVIDENCE_STATUSES).default('pending'),
  data: z.record(z.unknown()),
});
export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;

// ─── Policy ───
export const policyRulesSchema: z.ZodType<Record<string, unknown>> = z.record(z.unknown());

export const createPolicySchema = z.object({
  name: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  stage: z.enum(FLOW_STAGES),
  severity: z.enum(POLICY_SEVERITIES).default('blocking'),
  rules: z.object({
    when: z.record(z.unknown()).optional(),
    require: z.record(z.unknown()),
  }),
});
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export const updatePolicySchema = z.object({
  description: z.string().max(2000).nullable().optional(),
  severity: z.enum(POLICY_SEVERITIES).optional(),
  rules: z.object({
    when: z.record(z.unknown()).optional(),
    require: z.record(z.unknown()),
  }).optional(),
  enabled: z.boolean().optional(),
});

export const evaluatePolicySchema = z.object({
  flow_id: z.string().min(1),
  stage: z.enum(FLOW_STAGES),
});

// ─── Pagination ───
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// ─── GitHub ───
export const linkGithubRepoSchema = z.object({
  repo_owner: z.string().min(1),
  repo_name: z.string().min(1),
  sync_issues: z.boolean().default(true),
  sync_prs: z.boolean().default(true),
});

// ─── GitHub Integration ───
export const linkRepoSchema = z.object({
  installation_id: z.string().min(1),
  repo_full_name: z.string().min(1).regex(/^[^/]+\/[^/]+$/),
});
export type LinkRepoInput = z.infer<typeof linkRepoSchema>;

export const syncTaskSchema = z.object({
  repo_link_id: z.string().min(1),
});
export type SyncTaskInput = z.infer<typeof syncTaskSchema>;

// ─── Jira Integration ───
export const connectJiraSchema = z.object({
  site_url: z.string().url(),
  site_name: z.string().min(1).max(200),
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  token_expires_at: z.string().datetime().optional(),
});
export type ConnectJiraInput = z.infer<typeof connectJiraSchema>;

export const linkJiraProjectSchema = z.object({
  connection_id: z.string().min(1),
  project_key: z.string().min(1).max(20).regex(/^[A-Z][A-Z0-9_]+$/),
  project_name: z.string().min(1).max(200),
});
export type LinkJiraProjectInput = z.infer<typeof linkJiraProjectSchema>;

export const importJiraProjectSchema = z.object({
  project_link_id: z.string().min(1),
  include_done: z.boolean().default(false),
});
export type ImportJiraProjectInput = z.infer<typeof importJiraProjectSchema>;

export const syncJiraIssueSchema = z.object({
  project_link_id: z.string().min(1),
  issue_key: z.string().min(1).regex(/^[A-Z][A-Z0-9_]+-\d+$/),
});
export type SyncJiraIssueInput = z.infer<typeof syncJiraIssueSchema>;

// ─── Confluence Integration ───
export const linkConfluenceSpaceSchema = z.object({
  connection_id: z.string().min(1),
  space_key: z.string().min(1).max(50),
  space_name: z.string().min(1).max(200),
  parent_page_id: z.string().optional(),
  sync_direction: z.enum(['publish', 'pull']).default('publish'),
});
export type LinkConfluenceSpaceInput = z.infer<typeof linkConfluenceSpaceSchema>;

export const publishToConfluenceSchema = z.object({
  space_link_id: z.string().min(1),
});
export type PublishToConfluenceInput = z.infer<typeof publishToConfluenceSchema>;

export const pullFromConfluenceSchema = z.object({
  space_link_id: z.string().min(1),
  page_id: z.string().min(1),
});
export type PullFromConfluenceInput = z.infer<typeof pullFromConfluenceSchema>;

export const importConfluenceSpaceSchema = z.object({
  space_link_id: z.string().min(1),
  include_archived: z.boolean().default(false),
});
export type ImportConfluenceSpaceInput = z.infer<typeof importConfluenceSpaceSchema>;

// ─── LLM Connections ───
export const LLM_PROVIDERS = ['anthropic', 'openai', 'google'] as const;

export const createLlmConnectionSchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  display_name: z.string().min(1).max(200),
  api_key: z.string().min(1),
  model: z.string().min(1).max(100),
});
export type CreateLlmConnectionInput = z.infer<typeof createLlmConnectionSchema>;

export const updateLlmConnectionSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  api_key: z.string().min(1).optional(),
  model: z.string().min(1).max(100).optional(),
});
export type UpdateLlmConnectionInput = z.infer<typeof updateLlmConnectionSchema>;

// ─── CI Webhook ───
export const ciWebhookSchema = z.object({
  flow_id: z.string().min(1),
  type: z.enum(EVIDENCE_TYPES),
  status: z.enum(EVIDENCE_STATUSES),
  data: z.record(z.unknown()),
});

// ─── Approvals ───
export const createApprovalSchema = z.object({
  entity_type: z.enum(['artifact', 'flow']),
  entity_id: z.string().min(1),
  flow_id: z.string().min(1),
  workflow_type: z.enum(APPROVAL_WORKFLOW_TYPES).default('parallel'),
  required_approvers: z.number().int().min(1).max(10).default(1),
  approver_ids: z.array(z.string().min(1)).min(1).max(10),
});
export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;

export const respondApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().max(2000).optional(),
});
export type RespondApprovalInput = z.infer<typeof respondApprovalSchema>;

// ─── Compliance Reports ───
export const createComplianceReportSchema = z.object({
  framework: z.enum(COMPLIANCE_FRAMEWORKS),
  title: z.string().min(1).max(300),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
});
export type CreateComplianceReportInput = z.infer<typeof createComplianceReportSchema>;

// ─── API Keys ───
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.string()).min(1).default(['read']),
  expires_in_days: z.number().int().min(1).max(365).optional(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// ─── Outbound Webhooks ───
export const createWebhookSchema = z.object({
  url: z.string().url(),
  description: z.string().max(500).optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
  secret: z.string().min(16).max(256).optional(),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().max(500).nullable().optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
  secret: z.string().min(16).max(256).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// ─── GitLab ───
export const connectGitlabSchema = z.object({
  instance_url: z.string().url(),
  display_name: z.string().min(1).max(200),
  access_token: z.string().min(1),
});
export type ConnectGitlabInput = z.infer<typeof connectGitlabSchema>;

export const linkGitlabProjectSchema = z.object({
  connection_id: z.string().min(1),
  project_id: z.number().int().positive(),
  project_path: z.string().min(1),
  project_name: z.string().min(1).max(200),
  sync_mrs: z.boolean().default(true),
  sync_pipelines: z.boolean().default(true),
});
export type LinkGitlabProjectInput = z.infer<typeof linkGitlabProjectSchema>;

// ─── SSO ───
export const createSsoConfigSchema = z.object({
  provider: z.enum(SSO_PROVIDERS),
  display_name: z.string().min(1).max(200),
  config: z.record(z.unknown()),
  metadata_url: z.string().url().optional(),
});
export type CreateSsoConfigInput = z.infer<typeof createSsoConfigSchema>;

export const updateSsoConfigSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  metadata_url: z.string().url().nullable().optional(),
  enabled: z.boolean().optional(),
});
export type UpdateSsoConfigInput = z.infer<typeof updateSsoConfigSchema>;
