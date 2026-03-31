import * as argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import type { RegisterInput, LoginInput } from '@meridian/shared';
import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { UnauthorizedError, ConflictError } from '../../infra/errors.js';
import { slugify } from '@meridian/shared';
import { config } from '../../infra/config.js';

export const authService = {
  async register(input: RegisterInput, app: FastifyInstance) {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [input.email]);
    if (existing.rows.length > 0) {
      throw new ConflictError('Email already registered');
    }

    const userId = generateId('usr');
    const orgId = generateId('org');
    const memberId = generateId('mem');
    const passwordHash = await argon2.hash(input.password);
    const slug = slugify(input.org_name);

    await db.transaction(async (client) => {
      await client.query(
        'INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)',
        [userId, input.email, input.name, passwordHash],
      );
      await client.query(
        'INSERT INTO orgs (id, name, slug) VALUES ($1, $2, $3)',
        [orgId, input.org_name, slug],
      );
      await client.query(
        'INSERT INTO org_members (id, org_id, user_id, role) VALUES ($1, $2, $3, $4)',
        [memberId, orgId, userId, 'owner'],
      );
    });

    const accessToken = app.jwt.sign(
      { sub: userId, org_id: orgId, role: 'owner' },
      { expiresIn: config.jwtExpiry },
    );
    const refreshToken = generateId('rt');

    return {
      user: { id: userId, email: input.email, name: input.name },
      org: { id: orgId, name: input.org_name, slug },
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  },

  async login(input: LoginInput, app: FastifyInstance) {
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.password_hash, om.org_id, om.role, o.name as org_name, o.slug
       FROM users u
       JOIN org_members om ON om.user_id = u.id
       JOIN orgs o ON o.id = om.org_id
       WHERE u.email = $1
       LIMIT 1`,
      [input.email],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const user = result.rows[0];
    const valid = await argon2.verify(user.password_hash, input.password);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, org_id: user.org_id, role: user.role },
      { expiresIn: config.jwtExpiry },
    );
    const refreshToken = generateId('rt');

    return {
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: user.org_id, name: user.org_name, slug: user.slug, role: user.role },
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  },

  async refresh(refreshToken: string, app: FastifyInstance) {
    // For MVP, issue a new token pair
    // TODO: Implement proper refresh token rotation with DB storage
    const accessToken = app.jwt.sign(
      { sub: 'placeholder', org_id: 'placeholder', role: 'member' },
      { expiresIn: config.jwtExpiry },
    );
    return {
      access_token: accessToken,
      refresh_token: generateId('rt'),
    };
  },
};
