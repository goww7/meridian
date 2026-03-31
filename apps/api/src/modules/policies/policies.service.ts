import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { evaluate, buildPolicyContext } from '@meridian/policy-dsl';
import type { PolicyRules, GateResult, GateEvaluationResult, FlowStage, CreatePolicyInput } from '@meridian/shared';

export const policyService = {
  async create(orgId: string, input: CreatePolicyInput) {
    const id = generateId('pol');
    const result = await db.query(
      `INSERT INTO policies (id, org_id, name, description, stage, severity, rules)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, orgId, input.name, input.description || null, input.stage, input.severity, JSON.stringify(input.rules)],
    );
    return result.rows[0];
  },

  async list(orgId: string) {
    const result = await db.query('SELECT * FROM policies WHERE org_id = $1 AND deleted_at IS NULL ORDER BY stage, name', [orgId]);
    return result.rows;
  },

  async getById(orgId: string, id: string) {
    const result = await db.query('SELECT * FROM policies WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [id, orgId]);
    if (result.rows.length === 0) throw new NotFoundError('Policy', id);
    return result.rows[0];
  },

  async update(orgId: string, id: string, input: Record<string, unknown>) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); values.push(input.description); }
    if (input.severity !== undefined) { sets.push(`severity = $${idx++}`); values.push(input.severity); }
    if (input.rules !== undefined) { sets.push(`rules = $${idx++}`); values.push(JSON.stringify(input.rules)); }
    if (input.enabled !== undefined) { sets.push(`enabled = $${idx++}`); values.push(input.enabled); }
    sets.push('version = version + 1');
    sets.push('updated_at = now()');
    values.push(id, orgId);
    const result = await db.query(`UPDATE policies SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} AND deleted_at IS NULL RETURNING *`, values);
    if (result.rows.length === 0) throw new NotFoundError('Policy', id);
    return result.rows[0];
  },

  async remove(orgId: string, id: string) {
    await db.query('UPDATE policies SET deleted_at = now() WHERE id = $1 AND org_id = $2', [id, orgId]);
  },

  async evaluateGate(orgId: string, flowId: string, stage: FlowStage | string): Promise<GateResult> {
    // Load policies for this stage
    const policiesResult = await db.query(
      'SELECT * FROM policies WHERE org_id = $1 AND stage = $2 AND enabled = true AND deleted_at IS NULL',
      [orgId, stage],
    );
    const policies = policiesResult.rows;

    if (policies.length === 0) {
      return { passed: true, evaluations: [], blocking_failures: [], warnings: [] };
    }

    // Load flow data for context
    const [flowResult, artifactsResult, reqsResult, tasksResult, evidenceResult] = await Promise.all([
      db.query('SELECT * FROM flows WHERE id = $1 AND org_id = $2', [flowId, orgId]),
      db.query('SELECT type, status FROM artifacts WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]),
      db.query('SELECT status, priority FROM requirements WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]),
      db.query('SELECT status FROM tasks WHERE flow_id = $1 AND org_id = $2 AND deleted_at IS NULL', [flowId, orgId]),
      db.query('SELECT type, status, requirement_id FROM evidence WHERE flow_id = $1 AND org_id = $2', [flowId, orgId]),
    ]);

    if (flowResult.rows.length === 0) throw new NotFoundError('Flow', flowId);

    const context = buildPolicyContext({
      flow: flowResult.rows[0],
      artifacts: artifactsResult.rows,
      requirements: reqsResult.rows,
      tasks: tasksResult.rows,
      evidence: evidenceResult.rows,
      approvals: [],
      totalRequirements: reqsResult.rows.length,
    });

    // Evaluate each policy
    const evaluations: GateEvaluationResult[] = policies.map((policy: { id: string; name: string; rules: PolicyRules; severity: string }) => {
      const rules = typeof policy.rules === 'string' ? JSON.parse(policy.rules) : policy.rules;
      const evalResult = evaluate(rules, context);
      return {
        policy_id: policy.id,
        policy_name: policy.name,
        result: evalResult.result,
        severity: policy.severity as 'blocking' | 'warning' | 'info',
        details: evalResult.details,
      };
    });

    const blockingFailures = evaluations.filter((e) => e.result === 'fail' && e.severity === 'blocking');
    const warnings = evaluations.filter((e) => e.result === 'fail' && e.severity === 'warning');

    // Persist evaluations
    for (const evalItem of evaluations) {
      await db.query(
        'INSERT INTO policy_evaluations (id, org_id, flow_id, policy_id, stage, result, details) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [generateId('peval'), orgId, flowId, evalItem.policy_id, stage, evalItem.result, JSON.stringify(evalItem.details)],
      );
    }

    return {
      passed: blockingFailures.length === 0,
      evaluations,
      blocking_failures: blockingFailures,
      warnings,
    };
  },
};
