import crypto from 'node:crypto';
import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus, type MeridianEvent } from '../../infra/events.js';
import type { ConnectGitlabInput, LinkGitlabProjectInput } from '@meridian/shared';

export const gitlabService = {
  async connect(orgId: string, input: ConnectGitlabInput) {
    const id = generateId('glc');
    // Encrypt token (simple base64 for now — in production, use proper encryption)
    const encrypted = Buffer.from(input.access_token).toString('base64');
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const result = await db.query(
      `INSERT INTO gitlab_connections (id, org_id, instance_url, display_name, access_token_encrypted, webhook_secret)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, org_id, instance_url, display_name, webhook_secret, status, created_at`,
      [id, orgId, input.instance_url, input.display_name, encrypted, webhookSecret],
    );
    return result.rows[0];
  },

  async listConnections(orgId: string) {
    const result = await db.query(
      `SELECT id, org_id, instance_url, display_name, status, created_at, updated_at
       FROM gitlab_connections WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return result.rows;
  },

  async disconnect(orgId: string, connectionId: string) {
    const result = await db.query(
      `DELETE FROM gitlab_connections WHERE id = $1 AND org_id = $2 RETURNING *`,
      [connectionId, orgId],
    );
    if (result.rows.length === 0) throw new NotFoundError('GitlabConnection', connectionId);
  },

  async linkProject(orgId: string, flowId: string, input: LinkGitlabProjectInput) {
    const id = generateId('glpl');
    const result = await db.query(
      `INSERT INTO gitlab_project_links (id, org_id, flow_id, connection_id, project_id, project_path, project_name, sync_mrs, sync_pipelines)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, orgId, flowId, input.connection_id, input.project_id, input.project_path, input.project_name, input.sync_mrs, input.sync_pipelines],
    );
    return result.rows[0];
  },

  async listProjectLinks(orgId: string, flowId: string) {
    const result = await db.query(
      `SELECT gpl.*, gc.instance_url, gc.display_name as connection_name
       FROM gitlab_project_links gpl
       JOIN gitlab_connections gc ON gc.id = gpl.connection_id
       WHERE gpl.org_id = $1 AND gpl.flow_id = $2`,
      [orgId, flowId],
    );
    return result.rows;
  },

  async unlinkProject(orgId: string, linkId: string) {
    await db.query('DELETE FROM gitlab_project_links WHERE id = $1 AND org_id = $2', [linkId, orgId]);
  },

  async handleWebhook(connectionId: string, event: string, payload: Record<string, unknown>) {
    const conn = await db.query(`SELECT * FROM gitlab_connections WHERE id = $1`, [connectionId]);
    if (conn.rows.length === 0) return;
    const orgId = conn.rows[0].org_id;

    if (event === 'Pipeline Hook') {
      await this.handlePipelineEvent(orgId, connectionId, payload);
    } else if (event === 'Merge Request Hook') {
      await this.handleMergeRequestEvent(orgId, connectionId, payload);
    }
  },

  async handlePipelineEvent(orgId: string, connectionId: string, payload: Record<string, unknown>) {
    const project = payload.project as { id: number } | undefined;
    if (!project) return;

    const links = await db.query(
      `SELECT gpl.*, f.id as flow_id FROM gitlab_project_links gpl
       JOIN flows f ON f.id = gpl.flow_id
       WHERE gpl.connection_id = $1 AND gpl.project_id = $2 AND gpl.sync_pipelines = true`,
      [connectionId, project.id],
    );
    if (links.rows.length === 0) return;

    const attrs = payload.object_attributes as { status: string; id: number; ref: string } | undefined;
    if (!attrs) return;

    for (const link of links.rows) {
      const evidenceId = generateId('ev');
      const status = attrs.status === 'success' ? 'passing' : attrs.status === 'failed' ? 'failing' : 'pending';

      await db.query(
        `INSERT INTO evidence (id, org_id, flow_id, type, source, status, data)
         VALUES ($1, $2, $3, 'deployment', 'gitlab', $4, $5)`,
        [evidenceId, orgId, link.flow_id, status, JSON.stringify({ pipeline_id: attrs.id, ref: attrs.ref, status: attrs.status })],
      );

      eventBus.emit('evidence.collected', {
        org_id: orgId, entity_type: 'evidence', entity_id: evidenceId,
        event_type: 'evidence.collected', actor_id: null,
        data: { type: 'deployment', source: 'gitlab', flow_id: link.flow_id },
      });
    }
  },

  async handleMergeRequestEvent(orgId: string, connectionId: string, payload: Record<string, unknown>) {
    const project = payload.project as { id: number } | undefined;
    if (!project) return;

    const links = await db.query(
      `SELECT gpl.*, f.id as flow_id FROM gitlab_project_links gpl
       JOIN flows f ON f.id = gpl.flow_id
       WHERE gpl.connection_id = $1 AND gpl.project_id = $2 AND gpl.sync_mrs = true`,
      [connectionId, project.id],
    );
    if (links.rows.length === 0) return;

    const attrs = payload.object_attributes as { action: string; iid: number; state: string; title: string; url: string } | undefined;
    if (!attrs) return;

    if (attrs.action === 'merge' || attrs.state === 'merged') {
      for (const link of links.rows) {
        const evidenceId = generateId('ev');
        await db.query(
          `INSERT INTO evidence (id, org_id, flow_id, type, source, status, data)
           VALUES ($1, $2, $3, 'code_review', 'gitlab', 'passing', $4)`,
          [evidenceId, orgId, link.flow_id, JSON.stringify({ mr_iid: attrs.iid, title: attrs.title, url: attrs.url })],
        );

        eventBus.emit('evidence.collected', {
          org_id: orgId, entity_type: 'evidence', entity_id: evidenceId,
          event_type: 'evidence.collected', actor_id: null,
          data: { type: 'code_review', source: 'gitlab', flow_id: link.flow_id },
        });
      }
    }
  },

  setupEventListeners() {
    // No outbound listeners needed for GitLab — it's inbound webhook only
  },
};
