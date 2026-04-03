import type { FastifyInstance } from 'fastify';
import { connectJiraSchema, linkJiraProjectSchema, importJiraProjectSchema, syncJiraIssueSchema } from '@meridian/shared';
import { jiraService } from './jira.service.js';
import { config } from '../../infra/config.js';

export async function jiraRoutes(app: FastifyInstance) {
  // Webhook — no auth, verify signature
  app.post('/api/v1/jira/webhook', async (request, reply) => {
    const signature = request.headers['x-hub-signature'] as string;
    const payload = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

    const secret = config.jiraWebhookSecret;
    if (secret && signature) {
      if (!jiraService.verifyWebhookSignature(payload, signature, secret)) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body as Record<string, unknown>);
    const eventType = (body.webhookEvent as string) || 'unknown';
    const result = await jiraService.handleWebhook(eventType, body);
    return reply.status(200).send(result);
  });

  // Connections
  app.get('/api/v1/jira/connections', { preHandler: [app.requireAuth] }, async (request) => {
    return jiraService.listConnections(request.user.org_id);
  });

  app.post('/api/v1/jira/connections', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const input = connectJiraSchema.parse(request.body);
    const result = await jiraService.createConnection(request.user.org_id, input);
    return reply.status(201).send(result);
  });

  app.delete('/api/v1/jira/connections/:connectionId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { connectionId } = request.params as { connectionId: string };
    await jiraService.removeConnection(request.user.org_id, connectionId);
    return reply.status(204).send();
  });

  // Project links
  app.get('/api/v1/flows/:flowId/jira/links', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return jiraService.listProjectLinks(request.user.org_id, flowId);
  });

  app.post('/api/v1/flows/:flowId/jira/link', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const input = linkJiraProjectSchema.parse(request.body);
    const result = await jiraService.linkProject(request.user.org_id, flowId, input);
    return reply.status(201).send(result);
  });

  app.delete('/api/v1/flows/:flowId/jira/link/:linkId', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId, linkId } = request.params as { flowId: string; linkId: string };
    await jiraService.unlinkProject(request.user.org_id, flowId, linkId);
    return reply.status(204).send();
  });

  // Import
  app.post('/api/v1/flows/:flowId/jira/import', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const input = importJiraProjectSchema.parse(request.body);
    const result = await jiraService.importProject(request.user.org_id, flowId, input);
    return reply.status(200).send(result);
  });

  // Task sync
  app.post('/api/v1/flows/:flowId/tasks/:taskId/jira/sync', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const input = syncJiraIssueSchema.parse(request.body);
    const result = await jiraService.syncTaskToIssue(request.user.org_id, taskId, input);
    return reply.status(201).send(result);
  });
}
