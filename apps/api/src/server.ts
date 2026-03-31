import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './infra/config.js';
import { logger } from './infra/logger.js';
import { db } from './infra/db/client.js';
import { redis } from './infra/redis.js';
import { errorHandler } from './infra/errors.js';
import { authPlugin } from './infra/auth/plugin.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { orgRoutes } from './modules/orgs/orgs.routes.js';
import { teamRoutes } from './modules/teams/teams.routes.js';
import { flowRoutes } from './modules/flows/flows.routes.js';
import { initiativeRoutes } from './modules/initiatives/initiatives.routes.js';
import { objectiveRoutes } from './modules/objectives/objectives.routes.js';
import { requirementRoutes } from './modules/requirements/requirements.routes.js';
import { taskRoutes } from './modules/tasks/tasks.routes.js';
import { artifactRoutes } from './modules/artifacts/artifacts.routes.js';
import { evidenceRoutes } from './modules/evidence/evidence.routes.js';
import { policyRoutes } from './modules/policies/policies.routes.js';
import { graphRoutes } from './modules/graph/graph.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger,
    bodyLimit: 1048576,
  });

  // Override the default JSON parser to allow empty bodies (e.g. DELETE with Content-Type: application/json)
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.length === 0)) {
      done(null, null);
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Plugins
  await app.register(cors, { origin: config.corsOrigin, credentials: true });


  // Error handler
  app.setErrorHandler(errorHandler);

  // Health checks
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/health/ready', async () => {
    await db.query('SELECT 1');
    await redis.ping();
    return { db: 'ok', redis: 'ok' };
  });

  // Auth plugin (decorates request with user context)
  await app.register(authPlugin);

  // Routes
  await app.register(authRoutes);
  await app.register(orgRoutes);
  await app.register(teamRoutes);
  await app.register(flowRoutes);
  await app.register(initiativeRoutes);
  await app.register(objectiveRoutes);
  await app.register(requirementRoutes);
  await app.register(taskRoutes);
  await app.register(artifactRoutes);
  await app.register(evidenceRoutes);
  await app.register(policyRoutes);
  await app.register(graphRoutes);

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Meridian API running on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
