import { db } from '../../infra/db/client.js';
import { generateId } from '../../infra/id.js';
import { NotFoundError } from '../../infra/errors.js';
import { AnthropicProvider } from '../../ai/providers/anthropic.js';
import { OpenAIProvider } from '../../ai/providers/openai.js';
import { GoogleProvider } from '../../ai/providers/google.js';
import type { LlmProvider } from '../../ai/providers/types.js';
import type { CreateLlmConnectionInput, UpdateLlmConnectionInput } from '@meridian/shared';

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

function buildProvider(provider: string, apiKey: string): LlmProvider {
  switch (provider) {
    case 'openai': return new OpenAIProvider(apiKey);
    case 'google': return new GoogleProvider(apiKey);
    case 'anthropic':
    default: return new AnthropicProvider(apiKey);
  }
}

export const llmService = {
  async create(orgId: string, input: CreateLlmConnectionInput) {
    const id = generateId('llm');

    // If this is the first connection, make it active
    const existing = await db.query(
      'SELECT COUNT(*) as count FROM llm_connections WHERE org_id = $1 AND status = $2',
      [orgId, 'active'],
    );
    const isFirst = parseInt(existing.rows[0].count, 10) === 0;

    const result = await db.query(
      `INSERT INTO llm_connections (id, org_id, provider, display_name, api_key, model, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, org_id, provider, display_name, model, is_active, status, last_tested_at, created_at, updated_at`,
      [id, orgId, input.provider, input.display_name, input.api_key, input.model, isFirst],
    );
    return result.rows[0];
  },

  async list(orgId: string) {
    const result = await db.query(
      `SELECT id, org_id, provider, display_name, model, is_active, status, last_tested_at, created_at, updated_at
       FROM llm_connections WHERE org_id = $1 AND status = $2 ORDER BY is_active DESC, created_at DESC`,
      [orgId, 'active'],
    );
    return result.rows;
  },

  async get(orgId: string, connectionId: string) {
    const result = await db.query(
      `SELECT id, org_id, provider, display_name, model, is_active, status, last_tested_at, created_at, updated_at
       FROM llm_connections WHERE id = $1 AND org_id = $2 AND status = $3`,
      [connectionId, orgId, 'active'],
    );
    if (result.rows.length === 0) throw new NotFoundError('LLM Connection', connectionId);
    return result.rows[0];
  },

  async update(orgId: string, connectionId: string, input: UpdateLlmConnectionInput) {
    const conn = await this.get(orgId, connectionId);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.display_name) { fields.push(`display_name = $${idx++}`); values.push(input.display_name); }
    if (input.api_key) { fields.push(`api_key = $${idx++}`); values.push(input.api_key); }
    if (input.model) { fields.push(`model = $${idx++}`); values.push(input.model); }
    fields.push(`updated_at = now()`);

    if (fields.length <= 1) return conn; // nothing to update besides timestamp

    values.push(connectionId, orgId);
    const result = await db.query(
      `UPDATE llm_connections SET ${fields.join(', ')} WHERE id = $${idx++} AND org_id = $${idx}
       RETURNING id, org_id, provider, display_name, model, is_active, status, last_tested_at, created_at, updated_at`,
      values,
    );
    return result.rows[0];
  },

  async remove(orgId: string, connectionId: string) {
    await db.query(
      'UPDATE llm_connections SET status = $1, is_active = false, updated_at = now() WHERE id = $2 AND org_id = $3',
      ['deleted', connectionId, orgId],
    );
  },

  async activate(orgId: string, connectionId: string) {
    // Verify it exists
    await this.get(orgId, connectionId);

    // Deactivate all others
    await db.query(
      'UPDATE llm_connections SET is_active = false, updated_at = now() WHERE org_id = $1 AND status = $2',
      [orgId, 'active'],
    );
    // Activate this one
    const result = await db.query(
      `UPDATE llm_connections SET is_active = true, updated_at = now() WHERE id = $1 AND org_id = $2
       RETURNING id, org_id, provider, display_name, model, is_active, status, last_tested_at, created_at, updated_at`,
      [connectionId, orgId],
    );
    return result.rows[0];
  },

  async test(orgId: string, connectionId: string) {
    // Get full record with API key
    const result = await db.query(
      'SELECT * FROM llm_connections WHERE id = $1 AND org_id = $2 AND status = $3',
      [connectionId, orgId, 'active'],
    );
    if (result.rows.length === 0) throw new NotFoundError('LLM Connection', connectionId);

    const conn = result.rows[0];
    const provider = buildProvider(conn.provider, conn.api_key);

    try {
      const response = await provider.generate(
        [{ role: 'user', content: 'Respond with exactly: {"status":"ok"}' }],
        { model: conn.model, maxTokens: 32 },
      );

      await db.query('UPDATE llm_connections SET last_tested_at = now(), updated_at = now() WHERE id = $1', [connectionId]);

      return {
        success: true,
        provider: conn.provider,
        model: conn.model,
        response_length: response.text.length,
        usage: response.usage,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: conn.provider,
        model: conn.model,
        error: err.message || 'Unknown error',
      };
    }
  },

  /** Get the active LLM provider for an org, or null if none configured */
  async getActiveProvider(orgId: string): Promise<LlmProvider | null> {
    const result = await db.query(
      'SELECT * FROM llm_connections WHERE org_id = $1 AND is_active = true AND status = $2',
      [orgId, 'active'],
    );
    if (result.rows.length === 0) return null;

    const conn = result.rows[0];
    return buildProvider(conn.provider, conn.api_key);
  },

  /** Get the active model name for an org, or null */
  async getActiveModel(orgId: string): Promise<string | null> {
    const result = await db.query(
      'SELECT model FROM llm_connections WHERE org_id = $1 AND is_active = true AND status = $2',
      [orgId, 'active'],
    );
    return result.rows[0]?.model || null;
  },

  /** Available models per provider (for UI dropdown) */
  getAvailableModels() {
    return {
      anthropic: [
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', tier: 'balanced' },
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', tier: 'most capable' },
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', tier: 'fastest' },
      ],
      openai: [
        { id: 'gpt-5.4', name: 'GPT-5.4', tier: 'most capable' },
        { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', tier: 'balanced' },
        { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', tier: 'fastest' },
      ],
      google: [
        { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', tier: 'most capable' },
        { id: 'gemini-3-flash', name: 'Gemini 3 Flash', tier: 'balanced' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'fastest' },
      ],
    };
  },
};
