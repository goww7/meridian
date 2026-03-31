import type { FastifyInstance } from 'fastify';
import { graphService } from './graph.service.js';

export async function graphRoutes(app: FastifyInstance) {
  app.get('/api/v1/flows/:flowId/trace', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return graphService.getTraceability(request.user.org_id, flowId);
  });

  app.get('/api/v1/flows/:flowId/gaps', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return graphService.getGaps(request.user.org_id, flowId);
  });

  app.get('/api/v1/flows/:flowId/impact', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    const { requirement_id } = request.query as { requirement_id?: string };
    return graphService.getImpact(request.user.org_id, flowId, requirement_id);
  });
}
