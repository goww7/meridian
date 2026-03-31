import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, refreshSchema } from '@meridian/shared';
import { authService } from './auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/v1/auth/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const result = await authService.register(input, app);
    return reply.status(201).send(result);
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input, app);
    return reply.send(result);
  });

  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const { refresh_token } = refreshSchema.parse(request.body);
    const result = await authService.refresh(refresh_token, app);
    return reply.send(result);
  });

  app.post('/api/v1/auth/logout', { preHandler: [app.requireAuth] }, async (request, reply) => {
    return reply.status(204).send();
  });
}
