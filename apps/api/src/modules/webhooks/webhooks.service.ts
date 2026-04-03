import crypto from 'node:crypto';
import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { eventBus, type MeridianEvent } from '../../infra/events.js';
import type { CreateWebhookInput, UpdateWebhookInput } from '@meridian/shared';

export const webhookService = {
  async create(orgId: string, input: CreateWebhookInput) {
    const id = generateId('whk');
    const result = await db.query(
      `INSERT INTO outbound_webhooks (id, org_id, url, description, events, secret)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, orgId, input.url, input.description || null, input.events, input.secret || null],
    );
    return result.rows[0];
  },

  async list(orgId: string) {
    const result = await db.query(
      `SELECT * FROM outbound_webhooks WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return result.rows;
  },

  async getById(orgId: string, webhookId: string) {
    const result = await db.query(
      `SELECT * FROM outbound_webhooks WHERE id = $1 AND org_id = $2`,
      [webhookId, orgId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Webhook', webhookId);
    return result.rows[0];
  },

  async update(orgId: string, webhookId: string, input: UpdateWebhookInput) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (input.url !== undefined) { sets.push(`url = $${idx++}`); values.push(input.url); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); values.push(input.description); }
    if (input.events !== undefined) { sets.push(`events = $${idx++}`); values.push(input.events); }
    if (input.secret !== undefined) { sets.push(`secret = $${idx++}`); values.push(input.secret); }
    if (input.enabled !== undefined) { sets.push(`enabled = $${idx++}`); values.push(input.enabled); }
    sets.push('updated_at = now()');
    values.push(webhookId, orgId);

    const result = await db.query(
      `UPDATE outbound_webhooks SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) throw new NotFoundError('Webhook', webhookId);
    return result.rows[0];
  },

  async remove(orgId: string, webhookId: string) {
    await db.query('DELETE FROM outbound_webhooks WHERE id = $1 AND org_id = $2', [webhookId, orgId]);
  },

  async getDeliveries(orgId: string, webhookId: string) {
    // Verify ownership
    await this.getById(orgId, webhookId);
    const result = await db.query(
      `SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY attempted_at DESC LIMIT 50`,
      [webhookId],
    );
    return result.rows;
  },

  async deliver(orgId: string, eventType: string, payload: Record<string, unknown>) {
    const webhooks = await db.query(
      `SELECT * FROM outbound_webhooks WHERE org_id = $1 AND enabled = true AND $2 = ANY(events)`,
      [orgId, eventType],
    );

    for (const webhook of webhooks.rows) {
      const deliveryId = generateId('wdel');
      const body = JSON.stringify({ event: eventType, timestamp: new Date().toISOString(), data: payload });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webhook.secret) {
        const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
        headers['X-Meridian-Signature'] = `sha256=${signature}`;
      }

      try {
        const response = await fetch(webhook.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
        await db.query(
          `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, status_code, success, attempted_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [deliveryId, webhook.id, eventType, JSON.stringify(payload), response.status, response.ok],
        );

        if (response.ok) {
          await db.query(`UPDATE outbound_webhooks SET failure_count = 0, last_triggered_at = now() WHERE id = $1`, [webhook.id]);
        } else {
          await db.query(`UPDATE outbound_webhooks SET failure_count = failure_count + 1, last_triggered_at = now() WHERE id = $1`, [webhook.id]);
        }
      } catch {
        await db.query(
          `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, success, attempted_at)
           VALUES ($1, $2, $3, $4, false, now())`,
          [deliveryId, webhook.id, eventType, JSON.stringify(payload)],
        );
        await db.query(
          `UPDATE outbound_webhooks SET failure_count = failure_count + 1, last_triggered_at = now() WHERE id = $1`,
          [webhook.id],
        );
      }
    }
  },

  setupEventListeners() {
    const events = [
      'flow.created', 'flow.updated', 'flow.stage_changed',
      'artifact.generated', 'artifact.approved',
      'evidence.collected', 'task.updated',
      'policy.evaluated', 'approval.requested', 'approval.granted', 'approval.rejected',
    ];
    for (const event of events) {
      eventBus.on(event, (payload: MeridianEvent) => {
        this.deliver(payload.org_id, event, payload.data).catch(() => {});
      });
    }
  },
};
