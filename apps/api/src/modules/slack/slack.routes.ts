import type { FastifyInstance } from 'fastify';
import { slackService } from './slack.service.js';

export async function slackRoutes(app: FastifyInstance) {
  app.post('/api/v1/slack/integrations', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { channel_id, channel_name, webhook_url, events } = request.body as {
      channel_id: string; channel_name: string; webhook_url: string; events: string[];
    };
    const result = await slackService.create(request.user.org_id, channel_id, channel_name, webhook_url, events);
    return reply.status(201).send(result);
  });

  app.get('/api/v1/slack/integrations', { preHandler: [app.requireAuth] }, async (request) => {
    return slackService.list(request.user.org_id);
  });

  app.delete('/api/v1/slack/integrations/:id', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await slackService.remove(request.user.org_id, id);
    return reply.status(204).send();
  });

  app.post('/api/v1/slack/test', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { webhook_url } = request.body as { webhook_url: string };
    await slackService.sendMessage(webhook_url, 'Test message from Meridian');
    return reply.status(200).send({ ok: true });
  });
}
