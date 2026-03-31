import { Queue, Worker } from 'bullmq';
import { redis } from '../infra/redis.js';
import { generateArtifact } from './generate.js';

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
