import type { FastifyInstance } from 'fastify';
import { createRequirementSchema, updateRequirementSchema } from '@meridian/shared';
import { requirementService } from './requirements.service.js';

export async function requirementRoutes(app: FastifyInstance) {
  app.post('/api/v1/objectives/:objectiveId/requirements', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { objectiveId } = request.params as { objectiveId: string };
    const input = createRequirementSchema.parse(request.body);
    const req = await requirementService.create(request.user.org_id, objectiveId, input);
    return reply.status(201).send(req);
  });

  app.get('/api/v1/flows/:flowId/requirements', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return requirementService.listByFlow(request.user.org_id, flowId);
  });

  app.get('/api/v1/requirements/:requirementId', { preHandler: [app.requireAuth] }, async (request) => {
    const { requirementId } = request.params as { requirementId: string };
    return requirementService.getById(request.user.org_id, requirementId);
  });

  app.patch('/api/v1/requirements/:requirementId', { preHandler: [app.requireAuth] }, async (request) => {
    const { requirementId } = request.params as { requirementId: string };
    const input = updateRequirementSchema.parse(request.body);
    return requirementService.update(request.user.org_id, requirementId, input);
  });

  app.delete('/api/v1/requirements/:requirementId', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { requirementId } = request.params as { requirementId: string };
    await requirementService.remove(request.user.org_id, requirementId);
    return reply.status(204).send();
  });
}
