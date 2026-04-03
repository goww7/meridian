import type { FastifyInstance } from 'fastify';
import { createWebhookSchema, updateWebhookSchema } from '@meridian/shared';
import { webhookService } from './webhooks.service.js';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/api/v1/webhooks', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const input = createWebhookSchema.parse(request.body);
    const webhook = await webhookService.create(request.user.org_id, input);
    return reply.status(201).send(webhook);
  });

  app.get('/api/v1/webhooks', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    return webhookService.list(request.user.org_id);
  });

  app.get('/api/v1/webhooks/:webhookId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    const { webhookId } = request.params as { webhookId: string };
    return webhookService.getById(request.user.org_id, webhookId);
  });

  app.patch('/api/v1/webhooks/:webhookId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    const { webhookId } = request.params as { webhookId: string };
    const input = updateWebhookSchema.parse(request.body);
    return webhookService.update(request.user.org_id, webhookId, input);
  });

  app.delete('/api/v1/webhooks/:webhookId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    await webhookService.remove(request.user.org_id, webhookId);
    return reply.status(204).send();
  });

  app.get('/api/v1/webhooks/:webhookId/deliveries', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    const { webhookId } = request.params as { webhookId: string };
    return webhookService.getDeliveries(request.user.org_id, webhookId);
  });
}
