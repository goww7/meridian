import { z } from 'zod';
import {
  FLOW_STAGES, FLOW_STATUSES, PRIORITIES, SENSITIVITIES,
  ORG_ROLES, TEAM_ROLES, ARTIFACT_TYPES, ARTIFACT_STATUSES,
  REQUIREMENT_TYPES, REQUIREMENT_PRIORITIES, REQUIREMENT_STATUSES,
  TASK_STATUSES, EVIDENCE_TYPES, EVIDENCE_SOURCES, EVIDENCE_STATUSES,
  POLICY_SEVERITIES,
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

// ─── CI Webhook ───
export const ciWebhookSchema = z.object({
  flow_id: z.string().min(1),
  type: z.enum(EVIDENCE_TYPES),
  status: z.enum(EVIDENCE_STATUSES),
  data: z.record(z.unknown()),
});
