import type { FastifyInstance } from 'fastify';
import { createLlmConnectionSchema, updateLlmConnectionSchema } from '@meridian/shared';
import { llmService } from './llm.service.js';

export async function llmRoutes(app: FastifyInstance) {
  // List connections
  app.get('/api/v1/llm/connections', { preHandler: [app.requireAuth] }, async (request) => {
    return llmService.list(request.user.org_id);
  });

  // Available models (no auth needed for reference data)
  app.get('/api/v1/llm/models', async () => {
    return llmService.getAvailableModels();
  });

  // Create connection
  app.post('/api/v1/llm/connections', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const input = createLlmConnectionSchema.parse(request.body);
    const result = await llmService.create(request.user.org_id, input);
    return reply.status(201).send(result);
  });

  // Update connection
  app.patch('/api/v1/llm/connections/:connectionId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    const { connectionId } = request.params as { connectionId: string };
    const input = updateLlmConnectionSchema.parse(request.body);
    return llmService.update(request.user.org_id, connectionId, input);
  });

  // Delete connection
  app.delete('/api/v1/llm/connections/:connectionId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { connectionId } = request.params as { connectionId: string };
    await llmService.remove(request.user.org_id, connectionId);
    return reply.status(204).send();
  });

  // Activate connection (set as the org's active LLM provider)
  app.post('/api/v1/llm/connections/:connectionId/activate', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    const { connectionId } = request.params as { connectionId: string };
    return llmService.activate(request.user.org_id, connectionId);
  });

  // Test connection (sends a small prompt to verify the key works)
  app.post('/api/v1/llm/connections/:connectionId/test', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    const { connectionId } = request.params as { connectionId: string };
    return llmService.test(request.user.org_id, connectionId);
  });
}
