import type { FastifyInstance } from 'fastify';
import { notificationService } from './notifications.service.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/api/v1/notifications', { preHandler: [app.requireAuth] }, async (request) => {
    const query = request.query as Record<string, string>;
    return notificationService.list(request.user.id, query.cursor, query.limit ? parseInt(query.limit, 10) : undefined);
  });

  app.get('/api/v1/notifications/unread-count', { preHandler: [app.requireAuth] }, async (request) => {
    const count = await notificationService.unreadCount(request.user.id);
    return { count };
  });

  app.patch('/api/v1/notifications/:id/read', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await notificationService.markRead(request.user.id, id);
    return reply.status(200).send({ ok: true });
  });

  app.post('/api/v1/notifications/read-all', { preHandler: [app.requireAuth] }, async (request, reply) => {
    await notificationService.markAllRead(request.user.id);
    return reply.status(200).send({ ok: true });
  });
}
