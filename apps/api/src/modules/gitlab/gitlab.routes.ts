import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { connectGitlabSchema, linkGitlabProjectSchema } from '@meridian/shared';
import { gitlabService } from './gitlab.service.js';
import { db } from '../../infra/db/client.js';

export async function gitlabRoutes(app: FastifyInstance) {
  // Connect GitLab instance
  app.post('/api/v1/gitlab/connections', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const input = connectGitlabSchema.parse(request.body);
    const connection = await gitlabService.connect(request.user.org_id, input);
    return reply.status(201).send(connection);
  });

  // List connections
  app.get('/api/v1/gitlab/connections', { preHandler: [app.requireAuth] }, async (request) => {
    return gitlabService.listConnections(request.user.org_id);
  });

  // Disconnect
  app.delete('/api/v1/gitlab/connections/:connectionId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { connectionId } = request.params as { connectionId: string };
    await gitlabService.disconnect(request.user.org_id, connectionId);
    return reply.status(204).send();
  });

  // Link project to flow
  app.post('/api/v1/flows/:flowId/gitlab/projects', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const input = linkGitlabProjectSchema.parse(request.body);
    const link = await gitlabService.linkProject(request.user.org_id, flowId, input);
    return reply.status(201).send(link);
  });

  // List project links for flow
  app.get('/api/v1/flows/:flowId/gitlab/projects', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return gitlabService.listProjectLinks(request.user.org_id, flowId);
  });

  // Unlink project
  app.delete('/api/v1/gitlab/projects/:linkId', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { linkId } = request.params as { linkId: string };
    await gitlabService.unlinkProject(request.user.org_id, linkId);
    return reply.status(204).send();
  });

  // GitLab webhook receiver
  app.post('/api/v1/gitlab/webhook/:connectionId', async (request, reply) => {
    const { connectionId } = request.params as { connectionId: string };
    const gitlabToken = request.headers['x-gitlab-token'] as string;

    // Verify webhook secret
    const conn = await db.query(`SELECT webhook_secret FROM gitlab_connections WHERE id = $1`, [connectionId]);
    if (conn.rows.length === 0) return reply.status(404).send({ error: 'Connection not found' });
    if (conn.rows[0].webhook_secret && conn.rows[0].webhook_secret !== gitlabToken) {
      return reply.status(401).send({ error: 'Invalid webhook token' });
    }

    const event = request.headers['x-gitlab-event'] as string;
    await gitlabService.handleWebhook(connectionId, event, request.body as Record<string, unknown>);
    return reply.status(200).send({ ok: true });
  });
}
