import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';

export const initiativeService = {
  async create(orgId: string, flowId: string, input: { title: string; description?: string }) {
    const id = generateId('init');
    const result = await db.query(
      'INSERT INTO initiatives (id, org_id, flow_id, title, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, orgId, flowId, input.title, input.description || null],
    );
    eventBus.emit('initiative.created', { org_id: orgId, entity_type: 'initiative', entity_id: id, event_type: 'initiative.created', actor_id: null, data: {} });
    return result.rows[0];
  },

  async listByFlow(orgId: string, flowId: string) {
    const result = await db.query(
      'SELECT * FROM initiatives WHERE org_id = $1 AND flow_id = $2 AND deleted_at IS NULL ORDER BY created_at',
      [orgId, flowId],
    );
    return result.rows;
  },

  async getById(orgId: string, id: string) {
    const result = await db.query('SELECT * FROM initiatives WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [id, orgId]);
    if (result.rows.length === 0) throw new NotFoundError('Initiative', id);
    return result.rows[0];
  },

  async update(orgId: string, id: string, input: { title?: string; description?: string }) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (input.title) { sets.push(`title = $${idx++}`); values.push(input.title); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); values.push(input.description); }
    sets.push('updated_at = now()');
    values.push(id, orgId);
    const result = await db.query(`UPDATE initiatives SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} AND deleted_at IS NULL RETURNING *`, values);
    if (result.rows.length === 0) throw new NotFoundError('Initiative', id);
    return result.rows[0];
  },

  async remove(orgId: string, id: string) {
    await db.query('UPDATE initiatives SET deleted_at = now() WHERE id = $1 AND org_id = $2', [id, orgId]);
  },
};
