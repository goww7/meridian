import type { FastifyInstance } from 'fastify';
import { createTaskSchema, updateTaskSchema } from '@meridian/shared';
import { taskService } from './tasks.service.js';

export async function taskRoutes(app: FastifyInstance) {
  app.post('/api/v1/flows/:flowId/tasks', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const input = createTaskSchema.parse(request.body);
    const task = await taskService.create(request.user.org_id, flowId, input);
    return reply.status(201).send(task);
  });

  app.get('/api/v1/flows/:flowId/tasks', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return taskService.listByFlow(request.user.org_id, flowId);
  });

  app.get('/api/v1/tasks/:taskId', { preHandler: [app.requireAuth] }, async (request) => {
    const { taskId } = request.params as { taskId: string };
    return taskService.getById(request.user.org_id, taskId);
  });

  app.patch('/api/v1/tasks/:taskId', { preHandler: [app.requireAuth] }, async (request) => {
    const { taskId } = request.params as { taskId: string };
    const input = updateTaskSchema.parse(request.body);
    return taskService.update(request.user.org_id, taskId, input);
  });

  app.delete('/api/v1/tasks/:taskId', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    await taskService.remove(request.user.org_id, taskId);
    return reply.status(204).send();
  });
}
