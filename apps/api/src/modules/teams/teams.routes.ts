import type { FastifyInstance } from 'fastify';
import { createTeamSchema, addTeamMemberSchema } from '@meridian/shared';
import { teamService } from './teams.service.js';

export async function teamRoutes(app: FastifyInstance) {
  app.post('/api/v1/teams', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const input = createTeamSchema.parse(request.body);
    const team = await teamService.create(request.user.org_id, input);
    return reply.status(201).send(team);
  });

  app.get('/api/v1/teams', { preHandler: [app.requireAuth] }, async (request) => {
    return teamService.list(request.user.org_id);
  });

  app.get('/api/v1/teams/:teamId', { preHandler: [app.requireAuth] }, async (request) => {
    const { teamId } = request.params as { teamId: string };
    return teamService.getById(request.user.org_id, teamId);
  });

  app.patch('/api/v1/teams/:teamId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request) => {
    const { teamId } = request.params as { teamId: string };
    const input = createTeamSchema.partial().parse(request.body);
    return teamService.update(request.user.org_id, teamId, input);
  });

  app.delete('/api/v1/teams/:teamId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { teamId } = request.params as { teamId: string };
    await teamService.remove(request.user.org_id, teamId);
    return reply.status(204).send();
  });

  app.post('/api/v1/teams/:teamId/members', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { teamId } = request.params as { teamId: string };
    const input = addTeamMemberSchema.parse(request.body);
    const member = await teamService.addMember(request.user.org_id, teamId, input);
    return reply.status(201).send(member);
  });

  app.delete('/api/v1/teams/:teamId/members/:userId', { preHandler: [app.requireAuth, app.requireRole('admin')] }, async (request, reply) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    await teamService.removeMember(request.user.org_id, teamId, userId);
    return reply.status(204).send();
  });
}
