import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';

export const objectiveService = {
  async create(orgId: string, initiativeId: string, input: { title: string; description?: string; success_criteria?: string }) {
    const id = generateId('obj');
    const result = await db.query(
      'INSERT INTO objectives (id, org_id, initiative_id, title, description, success_criteria) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, orgId, initiativeId, input.title, input.description || null, input.success_criteria || null],
    );
    return result.rows[0];
  },

  async listByInitiative(orgId: string, initiativeId: string) {
    const result = await db.query(
      'SELECT * FROM objectives WHERE org_id = $1 AND initiative_id = $2 AND deleted_at IS NULL ORDER BY created_at',
      [orgId, initiativeId],
    );
    return result.rows;
  },

  async update(orgId: string, id: string, input: { title?: string; description?: string; success_criteria?: string }) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (input.title) { sets.push(`title = $${idx++}`); values.push(input.title); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); values.push(input.description); }
    if (input.success_criteria !== undefined) { sets.push(`success_criteria = $${idx++}`); values.push(input.success_criteria); }
    sets.push('updated_at = now()');
    values.push(id, orgId);
    const result = await db.query(`UPDATE objectives SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} AND deleted_at IS NULL RETURNING *`, values);
    if (result.rows.length === 0) throw new NotFoundError('Objective', id);
    return result.rows[0];
  },

  async remove(orgId: string, id: string) {
    await db.query('UPDATE objectives SET deleted_at = now() WHERE id = $1 AND org_id = $2', [id, orgId]);
  },
};
