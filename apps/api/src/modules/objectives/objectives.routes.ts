import type { FastifyInstance } from 'fastify';
import { createObjectiveSchema } from '@meridian/shared';
import { objectiveService } from './objectives.service.js';

export async function objectiveRoutes(app: FastifyInstance) {
  app.post('/api/v1/initiatives/:initiativeId/objectives', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { initiativeId } = request.params as { initiativeId: string };
    const input = createObjectiveSchema.parse(request.body);
    const objective = await objectiveService.create(request.user.org_id, initiativeId, input);
    return reply.status(201).send(objective);
  });

  app.get('/api/v1/initiatives/:initiativeId/objectives', { preHandler: [app.requireAuth] }, async (request) => {
    const { initiativeId } = request.params as { initiativeId: string };
    return objectiveService.listByInitiative(request.user.org_id, initiativeId);
  });

  app.patch('/api/v1/objectives/:objectiveId', { preHandler: [app.requireAuth] }, async (request) => {
    const { objectiveId } = request.params as { objectiveId: string };
    const input = createObjectiveSchema.partial().parse(request.body);
    return objectiveService.update(request.user.org_id, objectiveId, input);
  });

  app.delete('/api/v1/objectives/:objectiveId', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { objectiveId } = request.params as { objectiveId: string };
    await objectiveService.remove(request.user.org_id, objectiveId);
    return reply.status(204).send();
  });
}
