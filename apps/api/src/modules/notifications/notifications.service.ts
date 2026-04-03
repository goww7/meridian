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
    // --- Artifact approved ---
    eventBus.on('artifact.approved', async (data: { org_id: string; actor_id: string; entity_id: string; data?: { artifact?: { created_by?: string; title?: string; type?: string }; flow_id?: string; flow_title?: string } }) => {
      const createdBy = data.data?.artifact?.created_by;
      if (!createdBy || createdBy === data.actor_id) return;

      // Look up actor name and artifact/flow details for a meaningful message
      const [actorResult, artifactResult] = await Promise.all([
        db.query('SELECT name FROM users WHERE id = $1', [data.actor_id]).catch(() => ({ rows: [] })),
        data.entity_id ? db.query('SELECT a.title as artifact_title, a.type as artifact_type, f.title as flow_title FROM artifacts a LEFT JOIN flows f ON f.id = a.flow_id WHERE a.id = $1', [data.entity_id]).catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] }),
      ]);

      const actorName = actorResult.rows[0]?.name || 'Someone';
      const artifactTitle = artifactResult.rows[0]?.artifact_title || data.data?.artifact?.title || 'an artifact';
      const artifactType = artifactResult.rows[0]?.artifact_type || data.data?.artifact?.type || 'artifact';
      const flowTitle = artifactResult.rows[0]?.flow_title || data.data?.flow_title;

      const title = `${actorName} approved your ${artifactType}: "${artifactTitle}"`;
      const body = flowTitle ? `In flow "${flowTitle}". The artifact is now active and visible to your team.` : 'The artifact is now active and visible to your team.';

      await notificationService.create(data.org_id, createdBy, 'artifact_approved', title, body, 'artifact', data.data?.flow_id);
    });

    // --- Flow stage changed ---
    eventBus.on('flow.stage_changed', async (data: { org_id: string; entity_id: string; actor_id: string | null; data?: { from_stage?: string; to_stage?: string } }) => {
      const flowResult = await db.query('SELECT owner_id, title FROM flows WHERE id = $1', [data.entity_id]);
      if (flowResult.rows.length === 0 || !flowResult.rows[0].owner_id) return;

      const flow = flowResult.rows[0];
      const fromStage = data.data?.from_stage || 'unknown';
      const toStage = data.data?.to_stage || 'unknown';

      let actorName = 'Someone';
      if (data.actor_id) {
        const actorResult = await db.query('SELECT name FROM users WHERE id = $1', [data.actor_id]).catch(() => ({ rows: [] }));
        actorName = actorResult.rows[0]?.name || 'Someone';
      }

      const title = `"${flow.title}" advanced from ${fromStage} to ${toStage}`;
      const body = `${actorName} moved this flow forward. Review the ${toStage} stage requirements to keep progress on track.`;

      await notificationService.create(data.org_id, flow.owner_id, 'stage_changed', title, body, 'flow', data.entity_id);
    });

    // --- Approval requested ---
    eventBus.on('approval.requested', async (data: { org_id: string; entity_id: string; actor_id: string | null; data?: { entity_type?: string; entity_id?: string; flow_id?: string } }) => {
      // Notify all assignees
      const [assigneesResult, requesterResult, flowResult] = await Promise.all([
        db.query('SELECT user_id FROM approval_assignees WHERE approval_id = $1', [data.entity_id]),
        data.actor_id ? db.query('SELECT name FROM users WHERE id = $1', [data.actor_id]).catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] }),
        data.data?.flow_id ? db.query('SELECT title FROM flows WHERE id = $1', [data.data.flow_id]).catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] }),
      ]);

      const requesterName = requesterResult.rows[0]?.name || 'Someone';
      const flowTitle = flowResult.rows[0]?.title;
      const entityType = data.data?.entity_type || 'item';

      const title = `${requesterName} requested your approval on ${entityType === 'artifact' ? 'an artifact' : `a ${entityType}`}`;
      const body = flowTitle
        ? `In flow "${flowTitle}". Please review and approve or reject.`
        : `Please review and approve or reject this ${entityType}.`;

      for (const row of assigneesResult.rows) {
        if (row.user_id !== data.actor_id) {
          await notificationService.create(data.org_id, row.user_id, 'approval_requested', title, body, 'approval', data.entity_id);
        }
      }
    });

    // --- Approval granted ---
    eventBus.on('approval.granted', async (data: { org_id: string; entity_id: string; actor_id: string | null; data?: { decision?: string; final_status?: string } }) => {
      const [approvalResult, actorResult] = await Promise.all([
        db.query('SELECT a.requested_by, a.entity_type, a.flow_id, f.title as flow_title FROM approvals a LEFT JOIN flows f ON f.id = a.flow_id WHERE a.id = $1', [data.entity_id]),
        data.actor_id ? db.query('SELECT name FROM users WHERE id = $1', [data.actor_id]).catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] }),
      ]);

      if (approvalResult.rows.length === 0) return;
      const approval = approvalResult.rows[0];
      const actorName = actorResult.rows[0]?.name || 'Someone';
      const isFullyApproved = data.data?.final_status === 'approved';

      const title = isFullyApproved
        ? `Your ${approval.entity_type || 'item'} approval is fully approved`
        : `${actorName} approved your ${approval.entity_type || 'item'} approval request`;
      const body = approval.flow_title
        ? (isFullyApproved
          ? `All required approvers signed off on your ${approval.entity_type} in flow "${approval.flow_title}".`
          : `In flow "${approval.flow_title}". Waiting for remaining approvers.`)
        : (isFullyApproved
          ? `All required approvers have signed off.`
          : 'Waiting for remaining approvers.');

      if (approval.requested_by && approval.requested_by !== data.actor_id) {
        await notificationService.create(data.org_id, approval.requested_by, 'approval_granted', title, body, 'approval', data.entity_id);
      }
    });

    // --- Approval rejected ---
    eventBus.on('approval.rejected', async (data: { org_id: string; entity_id: string; actor_id: string | null; data?: Record<string, unknown> }) => {
      const [approvalResult, actorResult] = await Promise.all([
        db.query('SELECT a.requested_by, a.entity_type, a.flow_id, f.title as flow_title FROM approvals a LEFT JOIN flows f ON f.id = a.flow_id WHERE a.id = $1', [data.entity_id]),
        data.actor_id ? db.query('SELECT name FROM users WHERE id = $1', [data.actor_id]).catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] }),
      ]);

      if (approvalResult.rows.length === 0) return;
      const approval = approvalResult.rows[0];
      const actorName = actorResult.rows[0]?.name || 'Someone';

      const title = `${actorName} rejected your ${approval.entity_type || 'item'} approval request`;
      const body = approval.flow_title
        ? `In flow "${approval.flow_title}". Review their feedback and resubmit if needed.`
        : 'Review their feedback and resubmit when ready.';

      if (approval.requested_by && approval.requested_by !== data.actor_id) {
        await notificationService.create(data.org_id, approval.requested_by, 'approval_rejected', title, body, 'approval', data.entity_id);
      }
    });

    // --- Policy evaluated (failures only) ---
    eventBus.on('policy.evaluated', async (data: { org_id: string; entity_id: string; actor_id: string | null; data?: { flow_id?: string; gate_result?: { blocking_failures?: Array<{ policy_name: string; details: { message: string } }>; warnings?: Array<{ policy_name: string; details: { message: string } }> } } }) => {
      const gateResult = data.data?.gate_result;
      if (!gateResult?.blocking_failures?.length && !gateResult?.warnings?.length) return;

      const flowId = data.data?.flow_id || data.entity_id;
      const flowResult = await db.query('SELECT owner_id, title FROM flows WHERE id = $1', [flowId]).catch(() => ({ rows: [] }));
      if (flowResult.rows.length === 0 || !flowResult.rows[0].owner_id) return;

      const flow = flowResult.rows[0];
      const blockCount = gateResult.blocking_failures?.length || 0;
      const warnCount = gateResult.warnings?.length || 0;

      if (blockCount > 0) {
        const failureLines = gateResult.blocking_failures!.map(
          (f) => `• ${f.policy_name}: ${f.details?.message || 'requirement not met'}`,
        );
        const title = `${blockCount} blocking policy${blockCount > 1 ? ' failures' : ' failure'} on "${flow.title}"`;
        const body = `Stage transition blocked. Fix these to proceed:\n${failureLines.join('\n')}`;
        await notificationService.create(data.org_id, flow.owner_id, 'policy_blocked', title, body, 'flow', flowId);
      }

      if (warnCount > 0) {
        const warningLines = gateResult.warnings!.map(
          (w) => `• ${w.policy_name}: ${w.details?.message || 'requirement not met'}`,
        );
        const title = `${warnCount} policy warning${warnCount > 1 ? 's' : ''} on "${flow.title}"`;
        const body = `These don't block progress but should be addressed:\n${warningLines.join('\n')}`;
        await notificationService.create(data.org_id, flow.owner_id, 'policy_warning', title, body, 'flow', flowId);
      }
    });
  },
};
