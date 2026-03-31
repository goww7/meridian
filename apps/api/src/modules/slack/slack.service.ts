import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { eventBus } from '../../infra/events.js';

export const slackService = {
  async create(orgId: string, channelId: string, channelName: string, webhookUrl: string, events: string[]) {
    const id = generateId('slk');
    const result = await db.query(
      `INSERT INTO slack_integrations (id, org_id, channel_id, channel_name, webhook_url, events)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, orgId, channelId, channelName, webhookUrl, events],
    );
    return result.rows[0];
  },

  async list(orgId: string) {
    const result = await db.query('SELECT id, org_id, channel_id, channel_name, events, created_at FROM slack_integrations WHERE org_id = $1', [orgId]);
    return result.rows;
  },

  async remove(orgId: string, id: string) {
    await db.query('DELETE FROM slack_integrations WHERE id = $1 AND org_id = $2', [id, orgId]);
  },

  async sendMessage(webhookUrl: string, text: string, blocks?: unknown[]) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blocks ? { text, blocks } : { text }),
      });
    } catch { /* ignore send failures */ }
  },

  async broadcastToOrg(orgId: string, eventType: string, text: string) {
    const result = await db.query(
      "SELECT * FROM slack_integrations WHERE org_id = $1 AND $2 = ANY(events)",
      [orgId, eventType],
    );
    for (const integration of result.rows) {
      await this.sendMessage(integration.webhook_url, text);
    }
  },

  setupEventListeners() {
    eventBus.on('flow.stage_changed', (data: { org_id: string; entity_id: string; data?: { from_stage?: string; to_stage?: string } }) => {
      slackService.broadcastToOrg(data.org_id, 'flow.stage_changed',
        `Flow moved from *${data.data?.from_stage}* to *${data.data?.to_stage}*`);
    });

    eventBus.on('artifact.approved', (data: { org_id: string }) => {
      slackService.broadcastToOrg(data.org_id, 'artifact.approved', 'An artifact was approved');
    });
  },
};
