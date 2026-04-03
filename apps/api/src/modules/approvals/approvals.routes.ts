import type { FastifyInstance } from 'fastify';
import { createApprovalSchema, respondApprovalSchema } from '@meridian/shared';
import { approvalService } from './approvals.service.js';

export async function approvalRoutes(app: FastifyInstance) {
  // Create an approval request
  app.post('/api/v1/approvals', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const input = createApprovalSchema.parse(request.body);
    const approval = await approvalService.create(request.user.org_id, request.user.sub, input);
    return reply.status(201).send(approval);
  });

  // List my pending approvals
  app.get('/api/v1/approvals/pending', { preHandler: [app.requireAuth] }, async (request) => {
    return approvalService.listPending(request.user.org_id, request.user.sub);
  });

  // List approvals for a flow
  app.get('/api/v1/flows/:flowId/approvals', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return approvalService.listByFlow(request.user.org_id, flowId);
  });

  // Get approval detail
  app.get('/api/v1/approvals/:approvalId', { preHandler: [app.requireAuth] }, async (request) => {
    const { approvalId } = request.params as { approvalId: string };
    return approvalService.getById(request.user.org_id, approvalId);
  });

  // Respond to an approval
  app.post('/api/v1/approvals/:approvalId/respond', { preHandler: [app.requireAuth] }, async (request) => {
    const { approvalId } = request.params as { approvalId: string };
    const input = respondApprovalSchema.parse(request.body);
    return approvalService.respond(request.user.org_id, approvalId, request.user.sub, input);
  });
}
