import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';
import type { CreateEvidenceInput } from '@meridian/shared';

export const evidenceService = {
  async create(orgId: string, flowId: string, input: CreateEvidenceInput) {
    const id = generateId('evi');
    const result = await db.query(
      `INSERT INTO evidence (id, org_id, flow_id, requirement_id, type, source, status, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, orgId, flowId, input.requirement_id || null, input.type, input.source, input.status, JSON.stringify(input.data)],
    );

    eventBus.emit('evidence.collected', {
      org_id: orgId, entity_type: 'evidence', entity_id: id,
      event_type: 'evidence.collected', actor_id: null, data: { flow_id: flowId },
    });

    return result.rows[0];
  },

  async listByFlow(orgId: string, flowId: string) {
    const result = await db.query(
      'SELECT e.*, r.title as requirement_title FROM evidence e LEFT JOIN requirements r ON r.id = e.requirement_id WHERE e.org_id = $1 AND e.flow_id = $2 ORDER BY e.collected_at DESC',
      [orgId, flowId],
    );
    return result.rows;
  },

  async getById(orgId: string, id: string) {
    const result = await db.query('SELECT * FROM evidence WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (result.rows.length === 0) throw new NotFoundError('Evidence', id);
    return result.rows[0];
  },

  async remove(orgId: string, id: string) {
    await db.query('DELETE FROM evidence WHERE id = $1 AND org_id = $2', [id, orgId]);
  },
};
