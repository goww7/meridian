import type { FastifyInstance } from 'fastify';
import { generateArtifactSchema, createArtifactVersionSchema, regenerateArtifactSchema } from '@meridian/shared';
import { artifactService } from './artifacts.service.js';

export async function artifactRoutes(app: FastifyInstance) {
  app.post('/api/v1/flows/:flowId/artifacts/generate', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { flowId } = request.params as { flowId: string };
    const input = generateArtifactSchema.parse(request.body);
    const result = await artifactService.generate(request.user.org_id, flowId, request.user.id, input);
    return reply.status(202).send(result);
  });

  app.get('/api/v1/flows/:flowId/artifacts', { preHandler: [app.requireAuth] }, async (request) => {
    const { flowId } = request.params as { flowId: string };
    return artifactService.listByFlow(request.user.org_id, flowId);
  });

  app.get('/api/v1/artifacts/:artifactId', { preHandler: [app.requireAuth] }, async (request) => {
    const { artifactId } = request.params as { artifactId: string };
    return artifactService.getWithLatestVersion(request.user.org_id, artifactId);
  });

  app.get('/api/v1/artifacts/:artifactId/versions', { preHandler: [app.requireAuth] }, async (request) => {
    const { artifactId } = request.params as { artifactId: string };
    return artifactService.listVersions(request.user.org_id, artifactId);
  });

  app.post('/api/v1/artifacts/:artifactId/versions', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { artifactId } = request.params as { artifactId: string };
    const input = createArtifactVersionSchema.parse(request.body);
    const version = await artifactService.createVersion(request.user.org_id, artifactId, request.user.id, input);
    return reply.status(201).send(version);
  });

  app.post('/api/v1/artifacts/:artifactId/approve', {
    preHandler: [app.requireAuth, app.requireRole('admin')],
  }, async (request) => {
    const { artifactId } = request.params as { artifactId: string };
    return artifactService.approve(request.user.org_id, artifactId, request.user.id);
  });

  app.post('/api/v1/artifacts/:artifactId/reject', {
    preHandler: [app.requireAuth, app.requireRole('admin')],
  }, async (request) => {
    const { artifactId } = request.params as { artifactId: string };
    return artifactService.reject(request.user.org_id, artifactId);
  });

  app.post('/api/v1/artifacts/:artifactId/regenerate', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const { artifactId } = request.params as { artifactId: string };
    const input = regenerateArtifactSchema.parse(request.body);
    const result = await artifactService.regenerate(request.user.org_id, artifactId, request.user.id, input.feedback);
    return reply.status(202).send(result);
  });

  app.get('/api/v1/jobs/:jobId', { preHandler: [app.requireAuth] }, async (request) => {
    const { jobId } = request.params as { jobId: string };
    return artifactService.getJobStatus(jobId);
  });
}
