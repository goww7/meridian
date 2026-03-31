import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';
import type { CreateTaskInput } from '@meridian/shared';

export const taskService = {
  async create(orgId: string, flowId: string, input: CreateTaskInput) {
    const id = generateId('task');
    const result = await db.query(
      `INSERT INTO tasks (id, org_id, flow_id, requirement_id, title, description, assignee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, orgId, flowId, input.requirement_id || null, input.title, input.description || null, input.assignee_id || null],
    );
    eventBus.emit('task.created', { org_id: orgId, entity_type: 'task', entity_id: id, event_type: 'task.created', actor_id: null, data: {} });
    return result.rows[0];
  },

  async listByFlow(orgId: string, flowId: string) {
    const result = await db.query(
      `SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.org_id = $1 AND t.flow_id = $2 AND t.deleted_at IS NULL ORDER BY t.created_at`,
      [orgId, flowId],
    );
    return result.rows;
  },

  async getById(orgId: string, id: string) {
    const result = await db.query('SELECT * FROM tasks WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [id, orgId]);
    if (result.rows.length === 0) throw new NotFoundError('Task', id);
    return result.rows[0];
  },

  async update(orgId: string, id: string, input: Record<string, unknown>) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const field of ['title', 'description', 'status', 'assignee_id', 'requirement_id']) {
      if (input[field] !== undefined) { sets.push(`${field} = $${idx++}`); values.push(input[field]); }
    }
    sets.push('updated_at = now()');
    values.push(id, orgId);
    const result = await db.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} AND deleted_at IS NULL RETURNING *`, values);
    if (result.rows.length === 0) throw new NotFoundError('Task', id);

    if (input.status) {
      eventBus.emit('task.status_changed', { org_id: orgId, entity_type: 'task', entity_id: id, event_type: 'task.status_changed', actor_id: null, data: { status: input.status } });
    }
    return result.rows[0];
  },

  async remove(orgId: string, id: string) {
    await db.query('UPDATE tasks SET deleted_at = now() WHERE id = $1 AND org_id = $2', [id, orgId]);
  },
};
