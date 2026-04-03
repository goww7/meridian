import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';
import type { CreateApprovalInput, RespondApprovalInput } from '@meridian/shared';

export const approvalService = {
  async create(orgId: string, userId: string, input: CreateApprovalInput) {
    const id = generateId('appr');

    // Check for existing pending approval on same entity
    const existing = await db.query(
      `SELECT id FROM approvals WHERE org_id = $1 AND entity_type = $2 AND entity_id = $3 AND status = 'pending'`,
      [orgId, input.entity_type, input.entity_id],
    );
    if (existing.rows.length > 0) {
      throw new ConflictError('An approval request already exists for this entity');
    }

    const result = await db.transaction(async (client) => {
      const res = await client.query(
        `INSERT INTO approvals (id, org_id, entity_type, entity_id, flow_id, workflow_type, required_approvers, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [id, orgId, input.entity_type, input.entity_id, input.flow_id, input.workflow_type, input.required_approvers, userId],
      );

      // Create assignees
      for (let i = 0; i < input.approver_ids.length; i++) {
        await client.query(
          `INSERT INTO approval_assignees (id, approval_id, user_id, seq_order) VALUES ($1, $2, $3, $4)`,
          [generateId('asgn'), id, input.approver_ids[i], i],
        );
      }

      return res.rows[0];
    });

    eventBus.emit('approval.requested', {
      org_id: orgId, entity_type: 'approval', entity_id: id,
      event_type: 'approval.requested', actor_id: userId,
      data: { entity_type: input.entity_type, entity_id: input.entity_id, flow_id: input.flow_id },
    });

    return result;
  },

  async respond(orgId: string, approvalId: string, userId: string, input: RespondApprovalInput) {
    const approval = await db.query(
      `SELECT * FROM approvals WHERE id = $1 AND org_id = $2`,
      [approvalId, orgId],
    );
    if (approval.rows.length === 0) throw new NotFoundError('Approval', approvalId);

    const appr = approval.rows[0];
    if (appr.status !== 'pending') throw new ConflictError('Approval is no longer pending');

    // Check user is an assignee
    const assignee = await db.query(
      `SELECT * FROM approval_assignees WHERE approval_id = $1 AND user_id = $2`,
      [approvalId, userId],
    );
    if (assignee.rows.length === 0) throw new ForbiddenError('You are not an assigned approver');

    // Check for duplicate response
    const existingResponse = await db.query(
      `SELECT id FROM approval_responses WHERE approval_id = $1 AND user_id = $2`,
      [approvalId, userId],
    );
    if (existingResponse.rows.length > 0) throw new ConflictError('You have already responded to this approval');

    // For sequential workflows, check order
    if (appr.workflow_type === 'sequential') {
      const nextInSequence = await db.query(
        `SELECT aa.user_id FROM approval_assignees aa
         LEFT JOIN approval_responses ar ON ar.approval_id = aa.approval_id AND ar.user_id = aa.user_id
         WHERE aa.approval_id = $1 AND ar.id IS NULL
         ORDER BY aa.seq_order LIMIT 1`,
        [approvalId],
      );
      if (nextInSequence.rows.length > 0 && nextInSequence.rows[0].user_id !== userId) {
        throw new ForbiddenError('It is not your turn to approve in this sequential workflow');
      }
    }

    const responseId = generateId('aresp');

    const result = await db.transaction(async (client) => {
      await client.query(
        `INSERT INTO approval_responses (id, approval_id, user_id, decision, comment, seq_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [responseId, approvalId, userId, input.decision, input.comment || null, assignee.rows[0].seq_order],
      );

      if (input.decision === 'rejected') {
        // Any rejection immediately rejects the whole approval
        await client.query(
          `UPDATE approvals SET status = 'rejected', resolved_at = now(), updated_at = now() WHERE id = $1`,
          [approvalId],
        );
        return { ...appr, status: 'rejected' };
      }

      // Count approvals
      const approvalCount = await client.query(
        `SELECT COUNT(*) as cnt FROM approval_responses WHERE approval_id = $1 AND decision = 'approved'`,
        [approvalId],
      );
      const count = parseInt(approvalCount.rows[0].cnt, 10);

      if (appr.workflow_type === 'any' || count >= appr.required_approvers) {
        await client.query(
          `UPDATE approvals SET status = 'approved', current_approvals = $1, resolved_at = now(), updated_at = now() WHERE id = $2`,
          [count, approvalId],
        );
        return { ...appr, status: 'approved', current_approvals: count };
      }

      await client.query(
        `UPDATE approvals SET current_approvals = $1, updated_at = now() WHERE id = $2`,
        [count, approvalId],
      );
      return { ...appr, current_approvals: count };
    });

    const eventType = input.decision === 'approved' ? 'approval.granted' : 'approval.rejected';
    eventBus.emit(eventType, {
      org_id: orgId, entity_type: 'approval', entity_id: approvalId,
      event_type: eventType, actor_id: userId,
      data: { decision: input.decision, final_status: result.status },
    });

    // If fully approved, update the entity
    if (result.status === 'approved' && appr.entity_type === 'artifact') {
      await db.query(
        `UPDATE artifacts SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now() WHERE id = $2 AND org_id = $3`,
        [userId, appr.entity_id, orgId],
      );
      eventBus.emit('artifact.approved', {
        org_id: orgId, entity_type: 'artifact', entity_id: appr.entity_id,
        event_type: 'artifact.approved', actor_id: userId, data: {},
      });
    }

    return result;
  },

  async listByFlow(orgId: string, flowId: string) {
    const result = await db.query(
      `SELECT a.*, u.name as requester_name
       FROM approvals a
       LEFT JOIN users u ON u.id = a.requested_by
       WHERE a.org_id = $1 AND a.flow_id = $2
       ORDER BY a.created_at DESC`,
      [orgId, flowId],
    );
    return result.rows;
  },

  async listPending(orgId: string, userId: string) {
    const result = await db.query(
      `SELECT a.*, u.name as requester_name, f.title as flow_title
       FROM approvals a
       JOIN approval_assignees aa ON aa.approval_id = a.id AND aa.user_id = $2
       LEFT JOIN approval_responses ar ON ar.approval_id = a.id AND ar.user_id = $2
       LEFT JOIN users u ON u.id = a.requested_by
       LEFT JOIN flows f ON f.id = a.flow_id
       WHERE a.org_id = $1 AND a.status = 'pending' AND ar.id IS NULL
       ORDER BY a.created_at DESC`,
      [orgId, userId],
    );
    return result.rows;
  },

  async getById(orgId: string, approvalId: string) {
    const result = await db.query(
      `SELECT a.*, u.name as requester_name
       FROM approvals a LEFT JOIN users u ON u.id = a.requested_by
       WHERE a.id = $1 AND a.org_id = $2`,
      [approvalId, orgId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Approval', approvalId);

    const responses = await db.query(
      `SELECT ar.*, u.name as user_name, u.email as user_email
       FROM approval_responses ar LEFT JOIN users u ON u.id = ar.user_id
       WHERE ar.approval_id = $1 ORDER BY ar.seq_order, ar.created_at`,
      [approvalId],
    );

    const assignees = await db.query(
      `SELECT aa.*, u.name as user_name, u.email as user_email
       FROM approval_assignees aa LEFT JOIN users u ON u.id = aa.user_id
       WHERE aa.approval_id = $1 ORDER BY aa.seq_order`,
      [approvalId],
    );

    return { ...result.rows[0], responses: responses.rows, assignees: assignees.rows };
  },

  async getApprovalsByEntity(orgId: string, entityType: string, entityId: string) {
    const result = await db.query(
      `SELECT * FROM approvals WHERE org_id = $1 AND entity_type = $2 AND entity_id = $3 ORDER BY created_at DESC`,
      [orgId, entityType, entityId],
    );
    return result.rows;
  },
};
