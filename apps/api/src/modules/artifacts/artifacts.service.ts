import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus } from '../../infra/events.js';
import { aiQueue } from '../../ai/queue.js';
import type { GenerateArtifactInput, ArtifactType } from '@meridian/shared';

const ARTIFACT_TITLES: Record<string, string> = {
  assessment: 'Assessment',
  prd: 'Product Requirements Document',
  architecture: 'Architecture Document',
  test_plan: 'Test Plan',
  runbook: 'Runbook',
  custom: 'Custom Document',
};

export const artifactService = {
  async generate(orgId: string, flowId: string, userId: string, input: GenerateArtifactInput) {
    const artifactId = generateId('art');
    const jobId = generateId('job');

    await db.query(
      `INSERT INTO artifacts (id, org_id, flow_id, type, title, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')`,
      [artifactId, orgId, flowId, input.type, ARTIFACT_TITLES[input.type] || input.type],
    );

    await aiQueue.add('generate', {
      jobId,
      orgId,
      flowId,
      artifactId,
      artifactType: input.type,
      userId,
      context: input.context,
    });

    return { job_id: jobId, artifact_id: artifactId, status: 'queued' };
  },

  async listByFlow(orgId: string, flowId: string) {
    const result = await db.query(
      'SELECT * FROM artifacts WHERE org_id = $1 AND flow_id = $2 AND deleted_at IS NULL ORDER BY created_at',
      [orgId, flowId],
    );
    return result.rows;
  },

  async getWithLatestVersion(orgId: string, artifactId: string) {
    const artResult = await db.query('SELECT * FROM artifacts WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL', [artifactId, orgId]);
    if (artResult.rows.length === 0) throw new NotFoundError('Artifact', artifactId);

    const versionResult = await db.query(
      'SELECT * FROM artifact_versions WHERE artifact_id = $1 AND org_id = $2 ORDER BY version DESC LIMIT 1',
      [artifactId, orgId],
    );

    return {
      ...artResult.rows[0],
      latest_version: versionResult.rows[0] || null,
    };
  },

  async listVersions(orgId: string, artifactId: string) {
    const result = await db.query(
      'SELECT id, artifact_id, version, generated_by, token_usage, created_at FROM artifact_versions WHERE artifact_id = $1 AND org_id = $2 ORDER BY version DESC',
      [artifactId, orgId],
    );
    return result.rows;
  },

  async createVersion(orgId: string, artifactId: string, userId: string, input: { content: { sections: unknown[] }; content_text: string }) {
    const lastVersion = await db.query(
      'SELECT COALESCE(MAX(version), 0) as max_version FROM artifact_versions WHERE artifact_id = $1',
      [artifactId],
    );
    const nextVersion = lastVersion.rows[0].max_version + 1;
    const id = generateId('artv');

    const result = await db.query(
      `INSERT INTO artifact_versions (id, artifact_id, org_id, version, content, content_text, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, artifactId, orgId, nextVersion, JSON.stringify(input.content), input.content_text, userId],
    );
    return result.rows[0];
  },

  async approve(orgId: string, artifactId: string, userId: string) {
    const result = await db.query(
      `UPDATE artifacts SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now()
       WHERE id = $2 AND org_id = $3 AND deleted_at IS NULL RETURNING *`,
      [userId, artifactId, orgId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Artifact', artifactId);

    eventBus.emit('artifact.approved', {
      org_id: orgId, entity_type: 'artifact', entity_id: artifactId,
      event_type: 'artifact.approved', actor_id: userId, data: {},
    });

    return result.rows[0];
  },

  async reject(orgId: string, artifactId: string) {
    const result = await db.query(
      `UPDATE artifacts SET status = 'archived', updated_at = now() WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL RETURNING *`,
      [artifactId, orgId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Artifact', artifactId);
    return result.rows[0];
  },

  async regenerate(orgId: string, artifactId: string, userId: string, feedback: string) {
    const art = await db.query('SELECT * FROM artifacts WHERE id = $1 AND org_id = $2', [artifactId, orgId]);
    if (art.rows.length === 0) throw new NotFoundError('Artifact', artifactId);

    const jobId = generateId('job');
    await aiQueue.add('generate', {
      jobId,
      orgId,
      flowId: art.rows[0].flow_id,
      artifactId,
      artifactType: art.rows[0].type,
      userId,
      feedback,
      context: {},
    });

    return { job_id: jobId, artifact_id: artifactId, status: 'queued' };
  },

  async getJobStatus(jobId: string) {
    const job = await aiQueue.getJob(jobId);
    if (!job) return { id: jobId, status: 'not_found' };

    const state = await job.getState();
    return {
      id: jobId,
      status: state === 'completed' ? 'completed' : state === 'failed' ? 'failed' : 'processing',
      result: job.returnvalue,
      error: job.failedReason,
    };
  },
};
