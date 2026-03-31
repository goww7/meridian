import type { FastifyInstance } from 'fastify';
import { auditService } from './audit.service.js';

export async function auditRoutes(app: FastifyInstance) {
  app.get('/api/v1/audit', { preHandler: [app.requireAuth] }, async (request) => {
    const query = request.query as Record<string, string>;
    return auditService.list(request.user.org_id, {
      entity_type: query.entity_type,
      event_type: query.event_type,
      actor_id: query.actor_id,
      from_date: query.from_date,
      to_date: query.to_date,
      cursor: query.cursor,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  });
}
