import type { FastifyInstance } from 'fastify';
import { createPolicySchema, updatePolicySchema, evaluatePolicySchema } from '@meridian/shared';
import { policyService } from './policies.service.js';

export async function policyRoutes(app: FastifyInstance) {
  app.post('/api/v1/policies', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const input = createPolicySchema.parse(request.body);
    const policy = await policyService.create(request.user.org_id, input);
    return reply.status(201).send(policy);
  });

  app.get('/api/v1/policies', { preHandler: [app.requireAuth] }, async (request) => {
    return policyService.list(request.user.org_id);
  });

  app.get('/api/v1/policies/:policyId', { preHandler: [app.requireAuth] }, async (request) => {
    const { policyId } = request.params as { policyId: string };
    return policyService.getById(request.user.org_id, policyId);
  });

  app.patch('/api/v1/policies/:policyId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    const { policyId } = request.params as { policyId: string };
    const input = updatePolicySchema.parse(request.body);
    return policyService.update(request.user.org_id, policyId, input);
  });

  app.delete('/api/v1/policies/:policyId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { policyId } = request.params as { policyId: string };
    await policyService.remove(request.user.org_id, policyId);
    return reply.status(204).send();
  });

  app.post('/api/v1/policies/evaluate', { preHandler: [app.requireAuth] }, async (request) => {
    const input = evaluatePolicySchema.parse(request.body);
    return policyService.evaluateGate(request.user.org_id, input.flow_id, input.stage);
  });
}
