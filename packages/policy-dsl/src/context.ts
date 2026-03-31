import type { PolicyContext } from './types.js';

interface ContextInput {
  flow: {
    id: string;
    title: string;
    current_stage: string;
    status: string;
    priority: string;
    sensitivity: string;
    tags: string[];
  };
  artifacts: Array<{ type: string; status: string }>;
  requirements: Array<{ status: string; priority: string }>;
  tasks: Array<{ status: string }>;
  evidence: Array<{ type: string; status: string; requirement_id: string | null }>;
  approvals: Array<{ status: string }>;
  totalRequirements: number;
}

export function buildPolicyContext(input: ContextInput): PolicyContext {
  const { flow, artifacts, requirements, tasks, evidence, approvals } = input;

  // Artifacts
  const approvedArtifacts = artifacts.filter((a) => a.status === 'approved');

  // Requirements by status/priority
  const reqByStatus: Record<string, number> = {};
  const reqByPriority: Record<string, number> = {};
  for (const r of requirements) {
    reqByStatus[r.status] = (reqByStatus[r.status] || 0) + 1;
    reqByPriority[r.priority] = (reqByPriority[r.priority] || 0) + 1;
  }
  const implementedCount = (reqByStatus['implemented'] || 0) + (reqByStatus['verified'] || 0);
  const verifiedCount = reqByStatus['verified'] || 0;
  const totalReqs = requirements.length || 1;

  // Tasks by status
  const taskByStatus: Record<string, number> = {};
  for (const t of tasks) {
    taskByStatus[t.status] = (taskByStatus[t.status] || 0) + 1;
  }
  const completedTasks = taskByStatus['done'] || 0;
  const totalTasks = tasks.length || 1;

  // Evidence
  const evidenceByType: Record<string, { total: number; passing: number; failing: number }> = {};
  const evidenceByStatus: Record<string, number> = {};
  const reqsWithEvidence = new Set<string>();

  for (const e of evidence) {
    if (!evidenceByType[e.type]) {
      evidenceByType[e.type] = { total: 0, passing: 0, failing: 0 };
    }
    const bucket = evidenceByType[e.type]!;
    bucket.total++;
    if (e.status === 'passing') bucket.passing++;
    if (e.status === 'failing') bucket.failing++;
    evidenceByStatus[e.status] = (evidenceByStatus[e.status] || 0) + 1;
    if (e.requirement_id && e.status === 'passing') {
      reqsWithEvidence.add(e.requirement_id);
    }
  }

  const typesPresent = Object.keys(evidenceByType);
  const typesPassing = typesPresent.filter(
    (t) => evidenceByType[t]!.passing > 0 && evidenceByType[t]!.failing === 0,
  );

  // Approvals
  const approvalByStatus: Record<string, number> = {};
  for (const a of approvals) {
    approvalByStatus[a.status] = (approvalByStatus[a.status] || 0) + 1;
  }

  return {
    flow: {
      id: flow.id,
      title: flow.title,
      stage: flow.current_stage,
      status: flow.status,
      priority: flow.priority,
      sensitivity: flow.sensitivity,
      tags: flow.tags,
    },
    artifacts: {
      count: artifacts.length,
      types: [...new Set(artifacts.map((a) => a.type))],
      approved: [...new Set(approvedArtifacts.map((a) => a.type))],
    },
    requirements: {
      total: requirements.length,
      by_status: reqByStatus,
      by_priority: reqByPriority,
      implemented_ratio: implementedCount / totalReqs,
      verified_ratio: verifiedCount / totalReqs,
    },
    tasks: {
      total: tasks.length,
      by_status: taskByStatus,
      completion_ratio: completedTasks / totalTasks,
    },
    evidence: {
      total: evidence.length,
      by_type: evidenceByType,
      by_status: evidenceByStatus,
      coverage: reqsWithEvidence.size / (input.totalRequirements || 1),
      types_present: typesPresent,
      types_passing: typesPassing,
    },
    approvals: {
      total: approvals.length,
      approved: approvalByStatus['approved'] || 0,
      pending: approvalByStatus['pending'] || 0,
      rejected: approvalByStatus['rejected'] || 0,
    },
  };
}
