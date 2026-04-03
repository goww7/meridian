import type { FastifyInstance } from 'fastify';
import { createApiKeySchema } from '@meridian/shared';
import { apiKeyService } from './api-keys.service.js';

export async function apiKeyRoutes(app: FastifyInstance) {
  // Create API key
  app.post('/api/v1/api-keys', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const input = createApiKeySchema.parse(request.body);
    const key = await apiKeyService.create(request.user.org_id, request.user.sub, input);
    return reply.status(201).send(key);
  });

  // List API keys
  app.get('/api/v1/api-keys', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    return apiKeyService.list(request.user.org_id);
  });

  // Revoke API key
  app.delete('/api/v1/api-keys/:keyId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { keyId } = request.params as { keyId: string };
    await apiKeyService.revoke(request.user.org_id, keyId);
    return reply.status(204).send();
  });
}
