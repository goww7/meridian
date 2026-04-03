import type { FastifyInstance } from 'fastify';
import { searchService, analyticsService } from './search.service.js';

export async function searchRoutes(app: FastifyInstance) {
  app.get('/api/v1/search', { preHandler: [app.requireAuth] }, async (request) => {
    const { q, types } = request.query as { q: string; types?: string };
    if (!q || q.trim().length === 0) return [];
    const typeList = types ? types.split(',') : undefined;
    return searchService.search(request.user.org_id, q, typeList);
  });

  app.get('/api/v1/analytics/overview', { preHandler: [app.requireAuth] }, async (request) => {
    return analyticsService.overview(request.user.org_id);
  });

  app.get('/api/v1/analytics/advanced', { preHandler: [app.requireAuth] }, async (request) => {
    return analyticsService.advanced(request.user.org_id);
  });
}
