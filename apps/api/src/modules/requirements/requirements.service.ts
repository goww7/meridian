import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import type { CreateRequirementInput } from '@meridian/shared';

export const requirementService = {
  async create(orgId: string, objectiveId: string, input: CreateRequirementInput) {
    // Look up the flow_id from the objective's initiative
    const objResult = await db.query(
      'SELECT o.id, i.flow_id FROM objectives o JOIN initiatives i ON i.id = o.initiative_id WHERE o.id = $1 AND o.org_id = $2',
      [objectiveId, orgId],
    );
    if (objResult.rows.length === 0) throw new NotFoundError('Objective', objectiveId);
    const flowId = objResult.rows[0].flow_id;

    const id = generateId('req');
    const result = await db.query(
      `INSERT INTO requirements (id, org_id, flow_id, objective_id, title, description, type, priority, acceptance_criteria)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, orgId, flowId, objectiveId, input.title, input.description || null, input.type, input.priority, JSON.stringify(input.acceptance_criteria)],
    );
    return result.rows[0];
  },

  async listByFlow(orgId: string, flowId: string) {
    const result = await db.query(
      'SELECT * FROM requirements WHERE org_id = $1 AND flow_id = $2 AND deleted_at IS NULL ORDER BY created_at',
      [orgId, flowId],
    );
    return result.rows;
  },

  async getById(orgId: string, id: string) {
    const result = await db.query('SELECT * FROM requirements WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [id, orgId]);
    if (result.rows.length === 0) throw new NotFoundError('Requirement', id);
    return result.rows[0];
  },

  async update(orgId: string, id: string, input: Record<string, unknown>) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const fields = ['title', 'description', 'type', 'priority', 'status'] as const;
    for (const field of fields) {
      if (input[field] !== undefined) { sets.push(`${field} = $${idx++}`); values.push(input[field]); }
    }
    if (input.acceptance_criteria !== undefined) { sets.push(`acceptance_criteria = $${idx++}`); values.push(JSON.stringify(input.acceptance_criteria)); }
    sets.push('updated_at = now()');
    values.push(id, orgId);
    const result = await db.query(`UPDATE requirements SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} AND deleted_at IS NULL RETURNING *`, values);
    if (result.rows.length === 0) throw new NotFoundError('Requirement', id);
    return result.rows[0];
  },

  async remove(orgId: string, id: string) {
    await db.query('UPDATE requirements SET deleted_at = now() WHERE id = $1 AND org_id = $2', [id, orgId]);
  },
};
