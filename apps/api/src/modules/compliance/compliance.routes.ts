import type { FastifyInstance } from 'fastify';
import { createComplianceReportSchema } from '@meridian/shared';
import { complianceService } from './compliance.service.js';

export async function complianceRoutes(app: FastifyInstance) {
  // Create a compliance report
  app.post('/api/v1/compliance/reports', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const input = createComplianceReportSchema.parse(request.body);
    const report = await complianceService.createReport(request.user.org_id, request.user.sub, input);
    return reply.status(201).send(report);
  });

  // List compliance reports
  app.get('/api/v1/compliance/reports', { preHandler: [app.requireAuth] }, async (request) => {
    const { framework } = request.query as { framework?: string };
    return complianceService.list(request.user.org_id, framework);
  });

  // Get compliance report detail
  app.get('/api/v1/compliance/reports/:reportId', { preHandler: [app.requireAuth] }, async (request) => {
    const { reportId } = request.params as { reportId: string };
    return complianceService.getById(request.user.org_id, reportId);
  });

  // Get current compliance score
  app.get('/api/v1/compliance/score', { preHandler: [app.requireAuth] }, async (request) => {
    return complianceService.getComplianceScore(request.user.org_id);
  });
}
