import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { UnauthorizedError, ForbiddenError } from '../errors.js';
import type { OrgRole } from '@meridian/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      org_id: string;
      role: OrgRole;
    };
  }
}

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fjwt, { secret: config.jwtSecret });

  app.decorate('requireAuth', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
      // Map JWT 'sub' claim to 'id' for convenience
      const payload = request.user as unknown as Record<string, unknown>;
      if (payload.sub && !payload.id) {
        (request.user as Record<string, unknown>).id = payload.sub;
      }
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  });

  app.decorate('requireRole', (role: OrgRole) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      const userLevel = ROLE_HIERARCHY[request.user.role] ?? 0;
      const requiredLevel = ROLE_HIERARCHY[role] ?? 99;
      if (userLevel < requiredLevel) {
        throw new ForbiddenError(`Requires ${role} role or higher`);
      }
    };
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (role: OrgRole) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
