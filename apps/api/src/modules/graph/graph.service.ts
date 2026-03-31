import { db } from '../../infra/db/client.js';
import { NotFoundError } from '../../infra/errors.js';
import type { TraceGraph, GraphNode, GraphEdge } from '@meridian/shared';

export const graphService = {
  async getTraceability(orgId: string, flowId: string): Promise<TraceGraph> {
    // Build traceability tree from relational data
    // (Apache AGE queries can be added later for complex graph traversals)
    const [flowResult, initResult, objResult, reqResult, taskResult, evidenceResult, artifactResult] = await Promise.all([
      db.query('SELECT id, title, current_stage, status, priority, sensitivity FROM flows WHERE id = $1 AND org_id = $2', [flowId, orgId]),
      db.query('SELECT id, title, status FROM initiatives WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]),
      db.query('SELECT o.id, o.title, o.status, o.initiative_id FROM objectives o JOIN initiatives i ON i.id = o.initiative_id WHERE i.flow_id = $1 AND o.org_id = $2 AND o.deleted_at IS NULL', [flowId, orgId]),
      db.query('SELECT id, title, type, priority, status, objective_id FROM requirements WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]),
      db.query('SELECT id, title, status, requirement_id FROM tasks WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]),
      db.query('SELECT id, type, source, status, requirement_id FROM evidence WHERE flow_id = $1 AND org_id = $2', [flowId, orgId]),
      db.query('SELECT id, type, title, status FROM artifacts WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]),
    ]);

    if (flowResult.rows.length === 0) throw new NotFoundError('Flow', flowId);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Flow node
    const flow = flowResult.rows[0];
    nodes.push({ id: flow.id, type: 'Flow', label: flow.title, data: flow });

    // Initiatives
    for (const i of initResult.rows) {
      nodes.push({ id: i.id, type: 'Initiative', label: i.title, data: i });
      edges.push({ source: flow.id, target: i.id, type: 'HAS_INITIATIVE' });
    }

    // Objectives
    for (const o of objResult.rows) {
      nodes.push({ id: o.id, type: 'Objective', label: o.title, data: o });
      edges.push({ source: o.initiative_id, target: o.id, type: 'HAS_OBJECTIVE' });
    }

    // Requirements
    for (const r of reqResult.rows) {
      nodes.push({ id: r.id, type: 'Requirement', label: r.title, data: r });
      edges.push({ source: r.objective_id, target: r.id, type: 'HAS_REQUIREMENT' });
    }

    // Tasks
    for (const t of taskResult.rows) {
      nodes.push({ id: t.id, type: 'Task', label: t.title, data: t });
      if (t.requirement_id) edges.push({ source: t.requirement_id, target: t.id, type: 'IMPLEMENTED_BY' });
    }

    // Evidence
    for (const e of evidenceResult.rows) {
      nodes.push({ id: e.id, type: 'Evidence', label: `${e.type} (${e.status})`, data: e });
      if (e.requirement_id) {
        // Find task for this requirement
        const task = taskResult.rows.find((t: { requirement_id: string }) => t.requirement_id === e.requirement_id);
        if (task) edges.push({ source: task.id, target: e.id, type: 'HAS_EVIDENCE' });
      }
    }

    // Artifacts
    for (const a of artifactResult.rows) {
      nodes.push({ id: a.id, type: 'Artifact', label: `${a.type}: ${a.title}`, data: a });
      edges.push({ source: flow.id, target: a.id, type: 'HAS_ARTIFACT' });
    }

    return { nodes, edges };
  },

  async getGaps(orgId: string, flowId: string) {
    const [reqsWithoutTasks, reqsWithoutEvidence, objsWithoutReqs] = await Promise.all([
      db.query(
        `SELECT r.id, r.title FROM requirements r
         WHERE r.flow_id = $1 AND r.org_id = $2 AND r.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.requirement_id = r.id AND t.deleted_at IS NULL)`,
        [flowId, orgId],
      ),
      db.query(
        `SELECT r.id, r.title FROM requirements r
         WHERE r.flow_id = $1 AND r.org_id = $2 AND r.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM evidence e WHERE e.requirement_id = r.id AND e.status = 'passing')`,
        [flowId, orgId],
      ),
      db.query(
        `SELECT o.id, o.title FROM objectives o
         JOIN initiatives i ON i.id = o.initiative_id
         WHERE i.flow_id = $1 AND o.org_id = $2 AND o.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM requirements r WHERE r.objective_id = o.id AND r.deleted_at IS NULL)`,
        [flowId, orgId],
      ),
    ]);

    return {
      requirements_without_tasks: reqsWithoutTasks.rows,
      requirements_without_evidence: reqsWithoutEvidence.rows,
      objectives_without_requirements: objsWithoutReqs.rows,
    };
  },

  async getImpact(orgId: string, flowId: string, requirementId?: string) {
    if (!requirementId) {
      return { impacted_flows: [], impacted_requirements: [], impacted_tasks: [] };
    }

    const [reqResult, taskResult] = await Promise.all([
      db.query('SELECT id, title, status FROM requirements WHERE id = $1 AND org_id = $2', [requirementId, orgId]),
      db.query('SELECT id, title, status FROM tasks WHERE requirement_id = $1 AND org_id = $2 AND deleted_at IS NULL', [requirementId, orgId]),
    ]);

    return {
      requirement: reqResult.rows[0] || null,
      impacted_tasks: taskResult.rows,
    };
  },
};
