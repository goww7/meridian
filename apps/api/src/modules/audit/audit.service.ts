import { db } from '../../infra/db/client.js';

export const auditService = {
  async list(orgId: string, filters: {
    entity_type?: string;
    event_type?: string;
    actor_id?: string;
    from_date?: string;
    to_date?: string;
    cursor?: string;
    limit?: number;
  }) {
    const conditions = ['e.org_id = $1'];
    const values: unknown[] = [orgId];
    let idx = 2;

    if (filters.entity_type) { conditions.push(`e.entity_type = $${idx++}`); values.push(filters.entity_type); }
    if (filters.event_type) { conditions.push(`e.event_type = $${idx++}`); values.push(filters.event_type); }
    if (filters.actor_id) { conditions.push(`e.actor_id = $${idx++}`); values.push(filters.actor_id); }
    if (filters.from_date) { conditions.push(`e.created_at >= $${idx++}`); values.push(filters.from_date); }
    if (filters.to_date) { conditions.push(`e.created_at <= $${idx++}`); values.push(filters.to_date); }
    if (filters.cursor) { conditions.push(`e.id < $${idx++}`); values.push(filters.cursor); }

    const limit = Math.min(filters.limit || 50, 100);

    const result = await db.query(
      `SELECT e.*, u.name as actor_name, u.email as actor_email
       FROM events e
       LEFT JOIN users u ON u.id = e.actor_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.created_at DESC
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
};
