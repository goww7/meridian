import { db } from '../../infra/db/client.js';

export const searchService = {
  async search(orgId: string, query: string, types?: string[]) {
    const tsQuery = query.split(/\s+/).filter(Boolean).map(w => w + ':*').join(' & ');
    const results: { type: string; id: string; title: string; description?: string; rank: number }[] = [];

    const allowedTypes = types?.length ? types : ['flow', 'requirement', 'task'];

    if (allowedTypes.includes('flow')) {
      const r = await db.query(
        `SELECT id, title, description, ts_rank(search_vector, to_tsquery('english', $2)) as rank
         FROM flows WHERE org_id = $1 AND deleted_at IS NULL AND search_vector @@ to_tsquery('english', $2)
         ORDER BY rank DESC LIMIT 10`,
        [orgId, tsQuery],
      );
      results.push(...r.rows.map((row: Record<string, unknown>) => ({ type: 'flow', ...row } as typeof results[number])));
    }

    if (allowedTypes.includes('requirement')) {
      const r = await db.query(
        `SELECT id, title, description, ts_rank(search_vector, to_tsquery('english', $2)) as rank
         FROM requirements WHERE org_id = $1 AND deleted_at IS NULL AND search_vector @@ to_tsquery('english', $2)
         ORDER BY rank DESC LIMIT 10`,
        [orgId, tsQuery],
      );
      results.push(...r.rows.map((row: Record<string, unknown>) => ({ type: 'requirement', ...row } as typeof results[number])));
    }

    if (allowedTypes.includes('task')) {
      const r = await db.query(
        `SELECT id, title, description, ts_rank(search_vector, to_tsquery('english', $2)) as rank
         FROM tasks WHERE org_id = $1 AND deleted_at IS NULL AND search_vector @@ to_tsquery('english', $2)
         ORDER BY rank DESC LIMIT 10`,
        [orgId, tsQuery],
      );
      results.push(...r.rows.map((row: Record<string, unknown>) => ({ type: 'task', ...row } as typeof results[number])));
    }

    results.sort((a, b) => b.rank - a.rank);
    return results.slice(0, 25);
  },
};

export const analyticsService = {
  async overview(orgId: string) {
    const [flowsByStage, flowsByPriority, evidenceByType, evidenceByStatus, completedLast30] = await Promise.all([
      db.query("SELECT current_stage as stage, COUNT(*)::int as count FROM flows WHERE org_id = $1 AND deleted_at IS NULL GROUP BY current_stage", [orgId]),
      db.query("SELECT priority, COUNT(*)::int as count FROM flows WHERE org_id = $1 AND deleted_at IS NULL GROUP BY priority", [orgId]),
      db.query("SELECT type, COUNT(*)::int as count FROM evidence WHERE org_id = $1 GROUP BY type", [orgId]),
      db.query("SELECT status, COUNT(*)::int as count FROM evidence WHERE org_id = $1 GROUP BY status", [orgId]),
      db.query("SELECT COUNT(*)::int as count FROM flows WHERE org_id = $1 AND current_stage = 'done' AND updated_at > now() - interval '30 days'", [orgId]),
    ]);

    const toMap = (rows: { [key: string]: unknown }[], key: string) =>
      Object.fromEntries(rows.map(r => [r[key] as string, r.count as number]));

    return {
      flows_by_stage: toMap(flowsByStage.rows, 'stage'),
      flows_by_priority: toMap(flowsByPriority.rows, 'priority'),
      evidence_by_type: toMap(evidenceByType.rows, 'type'),
      evidence_by_status: toMap(evidenceByStatus.rows, 'status'),
      flows_completed_last_30_days: completedLast30.rows[0].count,
    };
  },
};
