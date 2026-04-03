import { config } from '../../infra/config.js';
import { db } from '../../infra/db/client.js';
import type { LlmProvider } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GoogleProvider } from './google.js';

export type { LlmProvider, LlmMessage, LlmOptions, LlmResponse, LlmUsage } from './types.js';

function buildProvider(providerName: string, apiKey: string): LlmProvider {
  switch (providerName) {
    case 'openai': return new OpenAIProvider(apiKey);
    case 'google': return new GoogleProvider(apiKey);
    case 'anthropic':
    default: return new AnthropicProvider(apiKey);
  }
}

/**
 * Get the LLM provider for an org.
 * 1. Checks the org's active DB connection first
 * 2. Falls back to env var configuration
 */
export async function getLlmProviderForOrg(orgId: string): Promise<{ provider: LlmProvider; model: string }> {
  // Check org's active DB connection
  const result = await db.query(
    'SELECT provider, api_key, model FROM llm_connections WHERE org_id = $1 AND is_active = true AND status = $2',
    [orgId, 'active'],
  );

  if (result.rows.length > 0) {
    const conn = result.rows[0];
    const provider = buildProvider(conn.provider, conn.api_key);
    return { provider, model: conn.model };
  }

  // Fall back to env vars
  const provider = buildProvider(config.llmProvider, config.llmApiKey);
  return { provider, model: config.llmModel || provider.defaultModel };
}

/** Synchronous fallback using env vars only (for non-org contexts) */
export function getLlmProvider(): LlmProvider {
  return buildProvider(config.llmProvider, config.llmApiKey);
}
