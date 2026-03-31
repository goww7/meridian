import type { FastifyInstance } from 'fastify';
import { linkRepoSchema, syncTaskSchema } from '@meridian/shared';
import { githubService } from './github.service.js';
import { config } from '../../infra/config.js';

export async function githubRoutes(app: FastifyInstance) {
  // Webhook — no auth, verify signature
  app.post('/api/v1/github/webhook', async (request, reply) => {
    const signature = request.headers['x-hub-signature-256'] as string;
    const event = request.headers['x-github-event'] as string;
    const payload = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

    const secret = config.githubWebhookSecret;
    if (secret && signature) {
      if (!githubService.verifyWebhookSignature(payload, signature, secret)) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const result = await githubService.handleWebhook(event, body as Record<string, unknown>);
    return reply.status(200).send(result);
  });

  // Installations
  app.get('/api/v1/github/installations', { preHandler: [app.requireAuth] }, async (request) => {
    return githubService.listInstallations(request.user.org_id);
  });

  app.post('/api/v1/github/installations/setup', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { installation_id, account_login, account_type, app_id } = request.body as {
      installation_id: number; account_login: string; account_type: string; app_id: number;
    };
    const result = await githubService.setupInstallation(request.user.org_id, installation_id, account_login, account_type, app_id);
    return reply.status(201).send(result);
  });

  app.delete('/api/v1/github/installations/:installationId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { installationId } = request.params as { installationId: string };
    await githubService.removeInstallation(request.user.org_id, installationId);
    return reply.status(204).send();
  });

  // Repo links
  app.get('/api/v1/flows/:flowId/github/links', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return githubService.listRepoLinks(request.user.org_id, flowId);
  });

  app.post('/api/v1/flows/:flowId/github/link', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const input = linkRepoSchema.parse(request.body);
    const result = await githubService.linkRepo(request.user.org_id, flowId, input);
    return reply.status(201).send(result);
  });

  app.delete('/api/v1/flows/:flowId/github/link/:linkId', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId, linkId } = request.params as { flowId: string; linkId: string };
    await githubService.unlinkRepo(request.user.org_id, flowId, linkId);
    return reply.status(204).send();
  });

  // Task sync
  app.post('/api/v1/flows/:flowId/tasks/:taskId/github/sync', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const input = syncTaskSchema.parse(request.body);
    const result = await githubService.syncTaskToIssue(request.user.org_id, taskId, input.repo_link_id);
    return reply.status(201).send(result);
  });
}
