import type { FastifyInstance } from 'fastify';
import { updateOrgSchema, inviteMemberSchema, updateMemberSchema } from '@meridian/shared';
import { orgService } from './orgs.service.js';

export async function orgRoutes(app: FastifyInstance) {
  app.get('/api/v1/orgs/current', { preHandler: [app.requireAuth] }, async (request) => {
    return orgService.getCurrent(request.user.org_id);
  });

  app.patch('/api/v1/orgs/current', {
    preHandler: [app.requireAuth, app.requireRole('admin')],
  }, async (request) => {
    const input = updateOrgSchema.parse(request.body);
    return orgService.update(request.user.org_id, input);
  });

  app.get('/api/v1/orgs/current/members', { preHandler: [app.requireAuth] }, async (request) => {
    return orgService.listMembers(request.user.org_id);
  });

  app.post('/api/v1/orgs/current/members/invite', {
    preHandler: [app.requireAuth, app.requireRole('admin')],
  }, async (request, reply) => {
    const input = inviteMemberSchema.parse(request.body);
    const member = await orgService.inviteMember(request.user.org_id, input);
    return reply.status(201).send(member);
  });

  app.patch('/api/v1/orgs/current/members/:userId', {
    preHandler: [app.requireAuth, app.requireRole('admin')],
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const input = updateMemberSchema.parse(request.body);
    return orgService.updateMemberRole(request.user.org_id, userId, input.role);
  });

  app.delete('/api/v1/orgs/current/members/:userId', {
    preHandler: [app.requireAuth, app.requireRole('admin')],
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    await orgService.removeMember(request.user.org_id, userId);
    return reply.status(204).send();
  });
}
