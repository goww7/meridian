import type { FastifyInstance } from 'fastify';
import { createEvidenceSchema } from '@meridian/shared';
import { evidenceService } from './evidence.service.js';

export async function evidenceRoutes(app: FastifyInstance) {
  app.post('/api/v1/flows/:flowId/evidence', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const input = createEvidenceSchema.parse(request.body);
    const evidence = await evidenceService.create(request.user.org_id, flowId, input);
    return reply.status(201).send(evidence);
  });

  app.get('/api/v1/flows/:flowId/evidence', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return evidenceService.listByFlow(request.user.org_id, flowId);
  });

  app.get('/api/v1/evidence/:evidenceId', { preHandler: [app.requireAuth] }, async (request) => {
    const { evidenceId } = request.params as { evidenceId: string };
    return evidenceService.getById(request.user.org_id, evidenceId);
  });

  app.delete('/api/v1/evidence/:evidenceId', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { evidenceId } = request.params as { evidenceId: string };
    await evidenceService.remove(request.user.org_id, evidenceId);
    return reply.status(204).send();
  });
}
