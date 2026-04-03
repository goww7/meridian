import type { FastifyInstance } from 'fastify';
import { createSsoConfigSchema, updateSsoConfigSchema } from '@meridian/shared';
import { ssoService } from './sso.service.js';

export async function ssoRoutes(app: FastifyInstance) {
  // Create SSO config
  app.post('/api/v1/sso/configs', { preHandler: [app.requireAuth, app.requireRole('owner')] }, async (request, reply) => {
    const input = createSsoConfigSchema.parse(request.body);
    const config = await ssoService.create(request.user.org_id, input);
    return reply.status(201).send(config);
  });

  // List SSO configs
  app.get('/api/v1/sso/configs', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    return ssoService.list(request.user.org_id);
  });

  // Get SSO config
  app.get('/api/v1/sso/configs/:ssoId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    const { ssoId } = request.params as { ssoId: string };
    return ssoService.getById(request.user.org_id, ssoId);
  });

  // Update SSO config
  app.patch('/api/v1/sso/configs/:ssoId', { preHandler: [app.requireAuth, app.requireRole('owner')] }, async (request) => {
    const { ssoId } = request.params as { ssoId: string };
    const input = updateSsoConfigSchema.parse(request.body);
    return ssoService.update(request.user.org_id, ssoId, input);
  });

  // Delete SSO config
  app.delete('/api/v1/sso/configs/:ssoId', { preHandler: [app.requireAuth, app.requireRole('owner')] }, async (request, reply) => {
    const { ssoId } = request.params as { ssoId: string };
    await ssoService.remove(request.user.org_id, ssoId);
    return reply.status(204).send();
  });

  // SP metadata endpoint (public)
  app.get('/api/v1/sso/:provider/metadata', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const orgSlug = (request.query as { org?: string }).org;
    if (!orgSlug) return reply.status(400).send({ error: 'org query parameter required' });

    // Look up org by slug
    const { db } = await import('../../infra/db/client.js');
    const orgResult = await db.query('SELECT id FROM orgs WHERE slug = $1', [orgSlug]);
    if (orgResult.rows.length === 0) return reply.status(404).send({ error: 'Organization not found' });

    const metadata = await ssoService.getServiceProviderMetadata(orgResult.rows[0].id, provider);
    return metadata;
  });
}
