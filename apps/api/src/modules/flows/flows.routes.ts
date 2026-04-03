import type { FastifyInstance } from 'fastify';
import { createFlowSchema, updateFlowSchema, transitionFlowSchema, listFlowsSchema } from '@meridian/shared';
import { flowService } from './flows.service.js';

export async function flowRoutes(app: FastifyInstance) {
  app.post('/api/v1/flows', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const input = createFlowSchema.parse(request.body);
    const flow = await flowService.create(request.user.org_id, request.user.id, input);
    return reply.status(201).send(flow);
  });

  app.get('/api/v1/flows', { preHandler: [app.requireAuth] }, async (request) => {
    const query = listFlowsSchema.parse(request.query);
    return flowService.list(request.user.org_id, query);
  });

  app.get('/api/v1/flows/:flowId', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return flowService.getDetail(request.user.org_id, flowId);
  });

  app.patch('/api/v1/flows/:flowId', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    const input = updateFlowSchema.parse(request.body);
    return flowService.update(request.user.org_id, flowId, input);
  });

  app.post('/api/v1/flows/:flowId/transition', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    const input = transitionFlowSchema.parse(request.body);
    return flowService.transition(request.user.org_id, flowId, request.user.id, input);
  });

  app.delete('/api/v1/flows/:flowId', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    await flowService.softDelete(request.user.org_id, flowId);
    return reply.status(204).send();
  });

  app.get('/api/v1/flows/:flowId/readiness', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return flowService.getReadiness(request.user.org_id, flowId);
  });

  app.post('/api/v1/flows/:flowId/kickstart', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const result = await flowService.kickstart(request.user.org_id, flowId, request.user.id);
    return reply.status(202).send(result);
  });

  app.post('/api/v1/flows/:flowId/kickstart-from-repo', { preHandler: [app.requireAuth, app.requireRole('member')] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const { repo_url } = request.body as { repo_url: string };
    if (!repo_url) return reply.status(400).send({ detail: 'repo_url is required' });
    const result = await flowService.kickstartFromRepo(request.user.org_id, flowId, request.user.id, repo_url);
    return reply.status(202).send(result);
  });

  app.get('/api/v1/flows/:flowId/traceability', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return flowService.getTraceability(request.user.org_id, flowId);
  });
}
