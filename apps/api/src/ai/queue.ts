import { Queue, Worker } from 'bullmq';
import { redis } from '../infra/redis.js';
import { generateArtifact } from './generate.js';
import { kickstartFlow } from './kickstart.js';
import { repoKickstartFlow } from './repo-kickstart.js';

export const aiQueue = new Queue('ai-generation', { connection: redis });

export const aiWorker = new Worker('ai-generation', async (job) => {
  const { jobId, orgId, flowId, artifactId, artifactType, userId, feedback, context } = job.data;
  return generateArtifact({ jobId, orgId, flowId, artifactId, artifactType, userId, feedback, context });
}, {
  connection: redis,
  concurrency: 3,
  limiter: { max: 10, duration: 60_000 },
});

aiWorker.on('failed', (job, err) => {
  console.error(`AI job ${job?.id} failed:`, err.message);
});

export const kickstartQueue = new Queue('ai-kickstart', { connection: redis });

export const kickstartWorker = new Worker('ai-kickstart', async (job) => {
  const { jobId, orgId, flowId, userId } = job.data;
  return kickstartFlow({ jobId, orgId, flowId, userId });
}, {
  connection: redis,
  concurrency: 2,
  limiter: { max: 5, duration: 60_000 },
});

kickstartWorker.on('failed', (job, err) => {
  console.error(`Kickstart job ${job?.id} failed:`, err.message);
});

export const repoKickstartQueue = new Queue('ai-repo-kickstart', { connection: redis });

export const repoKickstartWorker = new Worker('ai-repo-kickstart', async (job) => {
  const { jobId, orgId, flowId, userId, repoUrl } = job.data;
  return repoKickstartFlow({ jobId, orgId, flowId, userId, repoUrl });
}, {
  connection: redis,
  concurrency: 1,
  limiter: { max: 3, duration: 60_000 },
});

repoKickstartWorker.on('failed', (job, err) => {
  console.error(`Repo kickstart job ${job?.id} failed:`, err.message);
});
