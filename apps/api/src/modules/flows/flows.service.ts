import type { CreateFlowInput, UpdateFlowInput, TransitionFlowInput, FlowStage } from '@meridian/shared';
import { isValidTransition, parseSortParam, validateSortField } from '@meridian/shared';
import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError, ConflictError, GateFailedError, ValidationError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';
import { policyService } from '../policies/policies.service.js';
import { kickstartQueue, repoKickstartQueue } from '../../ai/queue.js';

export const flowService = {
  async create(orgId: string, userId: string, input: CreateFlowInput) {
    const id = generateId('flow');
    const result = await db.query(
      `INSERT INTO flows (id, org_id, title, description, priority, sensitivity, owner_id, team_id, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, orgId, input.title, input.description || null, input.priority, input.sensitivity, userId, input.team_id || null, input.tags],
    );
    const flow = result.rows[0];

    // Record initial stage transition
    await db.query(
      'INSERT INTO flow_stage_transitions (id, flow_id, org_id, from_stage, to_stage, triggered_by) VALUES ($1, $2, $3, NULL, $4, $5)',
      [generateId('fst'), id, orgId, 'assess', userId],
    );

    eventBus.emit('flow.created', {
      org_id: orgId, entity_type: 'flow', entity_id: id, event_type: 'flow.created',
      actor_id: userId, data: { flow },
    });

    return flow;
  },

  async list(orgId: string, query: Record<string, unknown>) {
    const conditions = ['f.org_id = $1', 'f.deleted_at IS NULL'];
    const values: unknown[] = [orgId];
    let idx = 2;

    if (query.status) { conditions.push(`f.status = $${idx++}`); values.push(query.status); }
    if (query.stage) { conditions.push(`f.current_stage = $${idx++}`); values.push(query.stage); }
    if (query.priority) { conditions.push(`f.priority = $${idx++}`); values.push(query.priority); }
    if (query.team_id) { conditions.push(`f.team_id = $${idx++}`); values.push(query.team_id); }
    if (query.owner_id) { conditions.push(`f.owner_id = $${idx++}`); values.push(query.owner_id); }
    if (query.search) { conditions.push(`f.title ILIKE $${idx++}`); values.push(`%${query.search}%`); }
    if (query.cursor) { conditions.push(`f.id < $${idx++}`); values.push(query.cursor); }

    const { field, direction } = parseSortParam(query.sort as string || '-updated_at');
    const sortField = validateSortField(field);
    const limit = Math.min(Number(query.limit) || 25, 100);

    const result = await db.query(
      `SELECT f.*, u.name as owner_name, t.name as team_name
       FROM flows f
       LEFT JOIN users u ON u.id = f.owner_id
       LEFT JOIN teams t ON t.id = f.team_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY f.${sortField} ${direction}
       LIMIT $${idx}`,
      [...values, limit + 1],
    );

    const hasMore = result.rows.length > limit;
    const data = hasMore ? result.rows.slice(0, limit) : result.rows;

    return {
      data,
      pagination: {
        next_cursor: hasMore ? data[data.length - 1].id : null,
        has_more: hasMore,
      },
    };
  },

  async getDetail(orgId: string, flowId: string) {
    const flowResult = await db.query(
      `SELECT f.*, u.name as owner_name, u.email as owner_email, t.name as team_name
       FROM flows f
       LEFT JOIN users u ON u.id = f.owner_id
       LEFT JOIN teams t ON t.id = f.team_id
       WHERE f.id = $1 AND f.org_id = $2 AND f.deleted_at IS NULL`,
      [flowId, orgId],
    );
    if (flowResult.rows.length === 0) throw new NotFoundError('Flow', flowId);

    const [countsResult, historyResult] = await Promise.all([
      db.query(
        `SELECT
          (SELECT COUNT(*) FROM initiatives WHERE flow_id = $1 AND deleted_at IS NULL)::int as initiatives,
          (SELECT COUNT(*) FROM objectives o JOIN initiatives i ON i.id = o.initiative_id WHERE i.flow_id = $1 AND o.deleted_at IS NULL)::int as objectives,
          (SELECT COUNT(*) FROM requirements WHERE flow_id = $1 AND deleted_at IS NULL)::int as requirements,
          (SELECT COUNT(*) FROM tasks WHERE flow_id = $1 AND deleted_at IS NULL)::int as tasks,
          (SELECT COUNT(*) FROM evidence WHERE flow_id = $1)::int as evidence,
          (SELECT COUNT(*) FROM artifacts WHERE flow_id = $1 AND deleted_at IS NULL)::int as artifacts`,
        [flowId],
      ),
      db.query(
        'SELECT * FROM flow_stage_transitions WHERE flow_id = $1 ORDER BY created_at',
        [flowId],
      ),
    ]);

    return {
      ...flowResult.rows[0],
      counts: countsResult.rows[0],
      stage_history: historyResult.rows,
    };
  },

  async update(orgId: string, flowId: string, input: UpdateFlowInput) {
    const current = await db.query('SELECT version FROM flows WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]);
    if (current.rows.length === 0) throw new NotFoundError('Flow', flowId);
    if (current.rows[0].version !== input.version) {
      throw new ConflictError('Flow has been modified by another user');
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fields = ['title', 'description', 'priority', 'sensitivity', 'owner_id', 'team_id', 'status'] as const;
    for (const field of fields) {
      if (input[field] !== undefined) {
        sets.push(`${field} = $${idx++}`);
        values.push(input[field]);
      }
    }
    if (input.tags !== undefined) { sets.push(`tags = $${idx++}`); values.push(input.tags); }
    sets.push(`version = version + 1`);
    sets.push(`updated_at = now()`);
    values.push(flowId, orgId);

    const result = await db.query(
      `UPDATE flows SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values,
    );
    return result.rows[0];
  },

  async transition(orgId: string, flowId: string, userId: string, input: TransitionFlowInput) {
    const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]);
    if (flowResult.rows.length === 0) throw new NotFoundError('Flow', flowId);

    const flow = flowResult.rows[0];
    const fromStage = flow.current_stage as FlowStage;
    const toStage = input.to_stage;

    if (!isValidTransition(fromStage, toStage)) {
      throw new ValidationError(`Invalid transition from '${fromStage}' to '${toStage}'`);
    }

    // Evaluate gate policies
    const gateResult = await policyService.evaluateGate(orgId, flowId, fromStage);

    if (!gateResult.passed) {
      // Build explicit failure summary
      const failureSummaries = gateResult.blocking_failures.map(
        (f: { policy_name: string; details: { message: string } }) =>
          `"${f.policy_name}": ${f.details?.message || 'requirement not met'}`,
      );
      const message = `Stage transition blocked by ${gateResult.blocking_failures.length} failed policy${gateResult.blocking_failures.length > 1 ? 'ies' : 'y'}: ${failureSummaries.join('; ')}`;

      // Record failed evaluation
      await db.query(
        'INSERT INTO flow_stage_transitions (id, flow_id, org_id, from_stage, to_stage, triggered_by, reason, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [generateId('fst'), flowId, orgId, fromStage, toStage, userId, message, JSON.stringify({ gate_result: gateResult })],
      );
      eventBus.emit('policy.evaluated', {
        org_id: orgId, entity_type: 'flow', entity_id: flowId, event_type: 'policy.evaluated',
        actor_id: userId, data: { flow_id: flowId, gate_result: gateResult },
      });

      throw new GateFailedError(message, gateResult);
    }

    // Advance the stage
    await db.query(
      'UPDATE flows SET current_stage = $1, updated_at = now(), version = version + 1 WHERE id = $2',
      [toStage, flowId],
    );
    await db.query(
      'INSERT INTO flow_stage_transitions (id, flow_id, org_id, from_stage, to_stage, triggered_by, reason) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [generateId('fst'), flowId, orgId, fromStage, toStage, userId, input.reason || null],
    );

    const updatedFlow = await db.query('SELECT * FROM flows WHERE id = $1', [flowId]);

    eventBus.emit('flow.stage_changed', {
      org_id: orgId, entity_type: 'flow', entity_id: flowId, event_type: 'flow.stage_changed',
      actor_id: userId, data: { from_stage: fromStage, to_stage: toStage },
    });

    return { flow: updatedFlow.rows[0], gate_result: gateResult };
  },

  async softDelete(orgId: string, flowId: string) {
    await db.query('UPDATE flows SET deleted_at = now() WHERE id = $1 AND org_id = $2', [flowId, orgId]);
  },

  async kickstart(orgId: string, flowId: string, userId: string) {
    // Verify flow exists
    const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]);
    if (flowResult.rows.length === 0) throw new NotFoundError('Flow', flowId);

    // Check if flow already has initiatives (prevent double-kickstart)
    const existing = await db.query('SELECT COUNT(*)::int as count FROM initiatives WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]);
    if (existing.rows[0].count > 0) {
      throw new ConflictError('Flow already has initiatives. Delete existing data before re-kickstarting.');
    }

    const jobId = generateId('job');
    await kickstartQueue.add('kickstart', { jobId, orgId, flowId, userId });
    return { job_id: jobId, status: 'queued' };
  },

  async kickstartFromRepo(orgId: string, flowId: string, userId: string, repoUrl: string) {
    const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]);
    if (flowResult.rows.length === 0) throw new NotFoundError('Flow', flowId);

    const existing = await db.query('SELECT COUNT(*)::int as count FROM initiatives WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]);
    if (existing.rows[0].count > 0) {
      throw new ConflictError('Flow already has initiatives. Delete existing data before re-kickstarting.');
    }

    const jobId = generateId('job');
    await repoKickstartQueue.add('repo-kickstart', { jobId, orgId, flowId, userId, repoUrl });
    return { job_id: jobId, status: 'queued' };
  },

  async getTraceability(orgId: string, flowId: string) {
    const [initResult, objResult, reqResult, taskResult, evidenceResult] = await Promise.all([
      db.query('SELECT id, title, status FROM initiatives WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL ORDER BY created_at', [flowId, orgId]),
      db.query('SELECT o.id, o.title, o.status, o.initiative_id, o.success_criteria FROM objectives o JOIN initiatives i ON i.id = o.initiative_id AND i.flow_id = $1 WHERE o.org_id = $2 AND o.deleted_at IS NULL ORDER BY o.created_at', [flowId, orgId]),
      db.query('SELECT id, title, description, type, priority, status, objective_id FROM requirements WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL ORDER BY created_at', [flowId, orgId]),
      db.query('SELECT id, title, status, requirement_id, assignee_id FROM tasks WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL ORDER BY created_at', [flowId, orgId]),
      db.query('SELECT id, type, status, requirement_id, source FROM evidence WHERE flow_id = $1 AND org_id = $2 ORDER BY collected_at DESC', [flowId, orgId]),
    ]);

    // Build the tree
    const initiatives = initResult.rows.map((init: any) => {
      const objectives = objResult.rows
        .filter((o: any) => o.initiative_id === init.id)
        .map((obj: any) => {
          const requirements = reqResult.rows
            .filter((r: any) => r.objective_id === obj.id)
            .map((req: any) => ({
              ...req,
              tasks: taskResult.rows.filter((t: any) => t.requirement_id === req.id),
              evidence: evidenceResult.rows.filter((e: any) => e.requirement_id === req.id),
            }));
          return { ...obj, requirements };
        });
      return { ...init, objectives };
    });

    // Unlinked tasks/evidence (not linked to any requirement)
    const unlinked_tasks = taskResult.rows.filter((t: any) => !t.requirement_id);
    const unlinked_evidence = evidenceResult.rows.filter((e: any) => !e.requirement_id);

    return { initiatives, unlinked_tasks, unlinked_evidence };
  },

  async getReadiness(orgId: string, flowId: string) {
    const flow = await db.query('SELECT * FROM flows WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]);
    if (flow.rows.length === 0) throw new NotFoundError('Flow', flowId);

    const [reqResult, evidenceResult] = await Promise.all([
      db.query('SELECT id, title, status FROM requirements WHERE flow_id = $1 AND deleted_at IS NULL', [flowId]),
      db.query('SELECT * FROM evidence WHERE flow_id = $1', [flowId]),
    ]);

    const requirements = reqResult.rows;
    const evidence = evidenceResult.rows;

    const reqsWithEvidence = new Set<string>();
    const failingEvidence: unknown[] = [];
    for (const e of evidence) {
      if (e.status === 'passing' && e.requirement_id) reqsWithEvidence.add(e.requirement_id);
      if (e.status === 'failing') failingEvidence.push(e);
    }

    const gaps = requirements
      .filter((r: { id: string }) => !reqsWithEvidence.has(r.id))
      .map((r: { id: string; title: string }) => ({ requirement_id: r.id, title: r.title, missing: ['evidence'] }));

    // Evaluate release gate
    const gateResults = await policyService.evaluateGate(orgId, flowId, 'release');

    return {
      flow_id: flowId,
      readiness: gateResults.passed && gaps.length === 0 ? 'ready' : 'not_ready',
      summary: {
        total_requirements: requirements.length,
        requirements_with_evidence: reqsWithEvidence.size,
        requirements_without_evidence: requirements.length - reqsWithEvidence.size,
        evidence_passing: evidence.filter((e: { status: string }) => e.status === 'passing').length,
        evidence_failing: evidence.filter((e: { status: string }) => e.status === 'failing').length,
      },
      gaps,
      failing_evidence: failingEvidence,
      gate_results: gateResults.evaluations,
    };
  },
};
