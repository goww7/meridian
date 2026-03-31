import type { FastifyInstance } from 'fastify';
import { createInitiativeSchema } from '@meridian/shared';
import { initiativeService } from './initiatives.service.js';

export async function initiativeRoutes(app: FastifyInstance) {
  app.post('/api/v1/flows/:flowId/initiatives', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const input = createInitiativeSchema.parse(request.body);
    const initiative = await initiativeService.create(request.user.org_id, flowId, input);
    return reply.status(201).send(initiative);
  });

  app.get('/api/v1/flows/:flowId/initiatives', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return initiativeService.listByFlow(request.user.org_id, flowId);
  });

  app.get('/api/v1/flows/:flowId/initiatives/:initiativeId', { preHandler: [app.requireAuth] }, async (request) => {
    const { initiativeId } = request.params as { initiativeId: string };
    return initiativeService.getById(request.user.org_id, initiativeId);
  });

  app.patch('/api/v1/flows/:flowId/initiatives/:initiativeId', { preHandler: [app.requireAuth] }, async (request) => {
    const { initiativeId } = request.params as { initiativeId: string };
    const input = createInitiativeSchema.partial().parse(request.body);
    return initiativeService.update(request.user.org_id, initiativeId, input);
  });

  app.delete('/api/v1/flows/:flowId/initiatives/:initiativeId', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { initiativeId } = request.params as { initiativeId: string };
    await initiativeService.remove(request.user.org_id, initiativeId);
    return reply.status(204).send();
  });
}
