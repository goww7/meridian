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

    // Search artifacts (semantic search across artifact content)
    if (allowedTypes.includes('artifact')) {
      const r = await db.query(
        `SELECT a.id, a.title, a.type as description,
                ts_rank(to_tsvector('english', COALESCE(av.content_text, '')), to_tsquery('english', $2)) as rank
         FROM artifacts a
         LEFT JOIN artifact_versions av ON av.artifact_id = a.id
           AND av.version = (SELECT MAX(version) FROM artifact_versions WHERE artifact_id = a.id)
         WHERE a.org_id = $1 AND a.deleted_at IS NULL
           AND to_tsvector('english', COALESCE(av.content_text, '')) @@ to_tsquery('english', $2)
         ORDER BY rank DESC LIMIT 10`,
        [orgId, tsQuery],
      );
      results.push(...r.rows.map((row: Record<string, unknown>) => ({ type: 'artifact', ...row } as typeof results[number])));
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

    // Pending approvals count
    let pendingApprovals = 0;
    try {
      const pa = await db.query(
        `SELECT COUNT(*)::int as count FROM approvals WHERE org_id = $1 AND status = 'pending'`,
        [orgId],
      );
      pendingApprovals = pa.rows[0].count;
    } catch { /* table may not exist yet */ }

    // Evidence total
    const evidenceTotal = await db.query(
      `SELECT COUNT(*)::int as count FROM evidence WHERE org_id = $1`,
      [orgId],
    );

    return {
      flows_by_stage: toMap(flowsByStage.rows, 'stage'),
      flows_by_priority: toMap(flowsByPriority.rows, 'priority'),
      evidence_by_type: toMap(evidenceByType.rows, 'type'),
      evidence_by_status: toMap(evidenceByStatus.rows, 'status'),
      completed_last_30_days: completedLast30.rows[0].count,
      pending_approvals: pendingApprovals,
      evidence_count: evidenceTotal.rows[0].count,
    };
  },

  async advanced(orgId: string) {
    // Cycle time: avg days per stage from stage transitions
    const cycleTimeResult = await db.query(
      `SELECT
        fst.from_stage,
        fst.to_stage,
        AVG(EXTRACT(EPOCH FROM (fst.created_at - prev.created_at)) / 86400)::numeric(10,1) as avg_days
       FROM flow_stage_transitions fst
       JOIN flows f ON f.id = fst.flow_id AND f.org_id = $1
       LEFT JOIN LATERAL (
         SELECT created_at FROM flow_stage_transitions
         WHERE flow_id = fst.flow_id AND created_at < fst.created_at
         ORDER BY created_at DESC LIMIT 1
       ) prev ON true
       WHERE prev.created_at IS NOT NULL
       GROUP BY fst.from_stage, fst.to_stage`,
      [orgId],
    );

    const byStage: Record<string, number> = {};
    let totalCycleDays = 0;
    let cycleCount = 0;
    for (const row of cycleTimeResult.rows) {
      const key = `${row.from_stage}_to_${row.to_stage}`;
      byStage[key] = parseFloat(row.avg_days);
      totalCycleDays += parseFloat(row.avg_days);
      cycleCount++;
    }

    // Lead time: time from creation to done
    const leadTimeResult = await db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (fst.created_at - f.created_at)) / 86400)::numeric(10,1) as avg_days
       FROM flow_stage_transitions fst
       JOIN flows f ON f.id = fst.flow_id AND f.org_id = $1
       WHERE fst.to_stage = 'done'`,
      [orgId],
    );
    const avgLeadTime = leadTimeResult.rows[0]?.avg_days ? parseFloat(leadTimeResult.rows[0].avg_days) : 0;

    // Weekly completions for last 8 weeks
    const weeklyResult = await db.query(
      `SELECT
         date_trunc('week', fst.created_at) as week,
         COUNT(*)::int as count
       FROM flow_stage_transitions fst
       JOIN flows f ON f.id = fst.flow_id AND f.org_id = $1
       WHERE fst.to_stage = 'done' AND fst.created_at > now() - interval '8 weeks'
       GROUP BY week ORDER BY week`,
      [orgId],
    );
    const weeklyCompletions = weeklyResult.rows.map((r: { count: number }) => r.count);

    // Approval turnaround
    let avgApprovalHours = 0;
    try {
      const approvalResult = await db.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric(10,1) as avg_hours
         FROM approvals WHERE org_id = $1 AND resolved_at IS NOT NULL`,
        [orgId],
      );
      avgApprovalHours = approvalResult.rows[0]?.avg_hours ? parseFloat(approvalResult.rows[0].avg_hours) : 0;
    } catch { /* table may not exist */ }

    // Compliance score
    let complianceScore = 0;
    try {
      const compResult = await db.query(
        `SELECT summary FROM compliance_reports WHERE org_id = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 1`,
        [orgId],
      );
      if (compResult.rows.length > 0) {
        const summary = typeof compResult.rows[0].summary === 'string'
          ? JSON.parse(compResult.rows[0].summary)
          : compResult.rows[0].summary;
        if (summary?.total_controls > 0) {
          complianceScore = summary.controls_met / summary.total_controls;
        }
      }
    } catch { /* table may not exist */ }

    // Determine velocity trend
    let velocityTrend: 'up' | 'down' | 'stable' = 'stable';
    if (weeklyCompletions.length >= 2) {
      const recent = weeklyCompletions.slice(-2);
      if (recent[1] > recent[0]) velocityTrend = 'up';
      else if (recent[1] < recent[0]) velocityTrend = 'down';
    }

    return {
      cycle_time: { avg_days: cycleCount > 0 ? totalCycleDays / cycleCount : 0, by_stage: byStage },
      lead_time: { avg_days: avgLeadTime, trend: weeklyCompletions },
      approval_turnaround: { avg_hours: avgApprovalHours, by_type: {} },
      compliance_score: { current: complianceScore, trend: [] },
      flow_velocity: { completed_per_week: weeklyCompletions, trend: velocityTrend },
    };
  },
};
