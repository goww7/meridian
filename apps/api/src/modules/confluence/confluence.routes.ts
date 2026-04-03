import type { FastifyInstance } from 'fastify';
import {
  linkConfluenceSpaceSchema,
  publishToConfluenceSchema,
  pullFromConfluenceSchema,
  importConfluenceSpaceSchema,
} from '@meridian/shared';
import { confluenceService } from './confluence.service.js';

export async function confluenceRoutes(app: FastifyInstance) {
  // Webhook — no auth, verify via Jira connection's webhook secret
  app.post('/api/v1/confluence/webhook', async (request, reply) => {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body as Record<string, unknown>);
    const eventType = (body.event as string) || 'unknown';
    const result = await confluenceService.handleWebhook(eventType, body);
    return reply.status(200).send(result);
  });

  // Space links
  app.get('/api/v1/flows/:flowId/confluence/spaces', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return confluenceService.listSpaceLinks(request.user.org_id, flowId);
  });

  app.post('/api/v1/flows/:flowId/confluence/spaces', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const input = linkConfluenceSpaceSchema.parse(request.body);
    const result = await confluenceService.createSpaceLink(request.user.org_id, flowId, input);
    return reply.status(201).send(result);
  });

  app.delete('/api/v1/flows/:flowId/confluence/spaces/:linkId', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId, linkId } = request.params as { flowId: string; linkId: string };
    await confluenceService.removeSpaceLink(request.user.org_id, flowId, linkId);
    return reply.status(204).send();
  });

  // Page links
  app.get('/api/v1/flows/:flowId/confluence/pages', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return confluenceService.listPageLinks(request.user.org_id, flowId);
  });

  // Publish artifact → Confluence
  app.post('/api/v1/artifacts/:artifactId/confluence/publish', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { artifactId } = request.params as { artifactId: string };
    const input = publishToConfluenceSchema.parse(request.body);
    const result = await confluenceService.publishArtifact(request.user.org_id, artifactId, input);
    return reply.status(200).send(result);
  });

  // Pull Confluence page → artifact
  app.post('/api/v1/artifacts/:artifactId/confluence/pull', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { artifactId } = request.params as { artifactId: string };
    const input = pullFromConfluenceSchema.parse(request.body);
    const result = await confluenceService.pullPage(request.user.org_id, artifactId, input);
    return reply.status(200).send(result);
  });

  // Bulk import space
  app.post('/api/v1/flows/:flowId/confluence/import', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const input = importConfluenceSpaceSchema.parse(request.body);
    const result = await confluenceService.importSpace(request.user.org_id, flowId, input);
    return reply.status(200).send(result);
  });
}
