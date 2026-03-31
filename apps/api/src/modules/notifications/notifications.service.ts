import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { eventBus } from '../../infra/events.js';

export const notificationService = {
  async create(orgId: string, userId: string, type: string, title: string, body?: string, entityType?: string, entityId?: string) {
    const id = generateId('ntf');
    await db.query(
      `INSERT INTO notifications (id, org_id, user_id, type, title, body, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, orgId, userId, type, title, body || null, entityType || null, entityId || null],
    );
    return id;
  },

  async list(userId: string, cursor?: string, limit: number = 25) {
    const conditions = ['user_id = $1'];
    const values: unknown[] = [userId];
    let idx = 2;
    if (cursor) { conditions.push(`id < $${idx++}`); values.push(cursor); }
    const safeLimit = Math.min(limit, 100);

    const result = await db.query(
      `SELECT * FROM notifications WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx}`,
      [...values, safeLimit + 1],
    );
    const hasMore = result.rows.length > safeLimit;
    const data = hasMore ? result.rows.slice(0, safeLimit) : result.rows;
    return { data, pagination: { next_cursor: hasMore ? data[data.length - 1].id : null, has_more: hasMore } };
  },

  async unreadCount(userId: string) {
    const result = await db.query('SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId]);
    return result.rows[0].count;
  },

  async markRead(userId: string, notificationId: string) {
    await db.query('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2', [notificationId, userId]);
  },

  async markAllRead(userId: string) {
    await db.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId]);
  },

  setupEventListeners() {
    eventBus.on('artifact.approved', async (data: { org_id: string; actor_id: string; data?: { artifact?: { created_by?: string }; flow_id?: string } }) => {
      const createdBy = data.data?.artifact?.created_by;
      if (createdBy && createdBy !== data.actor_id) {
        await notificationService.create(data.org_id, createdBy, 'artifact_approved', 'Your artifact was approved', undefined, 'artifact', data.data?.flow_id);
      }
    });

    eventBus.on('flow.stage_changed', async (data: { org_id: string; entity_id: string; data?: { from_stage?: string; to_stage?: string } }) => {
      const flowResult = await db.query('SELECT owner_id, title FROM flows WHERE id = $1', [data.entity_id]);
      if (flowResult.rows.length > 0 && flowResult.rows[0].owner_id) {
        await notificationService.create(
          data.org_id, flowResult.rows[0].owner_id, 'stage_changed',
          `"${flowResult.rows[0].title}" moved to ${data.data?.to_stage}`,
          undefined, 'flow', data.entity_id,
        );
      }
    });
  },
};
