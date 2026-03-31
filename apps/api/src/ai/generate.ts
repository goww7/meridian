import Anthropic from '@anthropic-ai/sdk';
import { db } from '../infra/db/client.js';
import { generateId } from '../infra/id.js';
import { config } from '../infra/config.js';
import { eventBus } from '../infra/events.js';
import { loadPrompt } from './prompts.js';

interface GenerateInput {
  jobId: string;
  orgId: string;
  flowId: string;
  artifactId: string;
  artifactType: string;
  userId: string;
  feedback?: string;
  context: Record<string, unknown>;
}

export async function generateArtifact(input: GenerateInput) {
  const { orgId, flowId, artifactId, artifactType, userId, feedback } = input;

  // Load flow context
  const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND org_id = $2', [flowId, orgId]);
  const flow = flowResult.rows[0];

  // Load previous artifacts
  const prevArtifacts = await db.query(
    `SELECT a.type, a.title, av.content_text
     FROM artifacts a
     JOIN artifact_versions av ON av.artifact_id = a.id
     WHERE a.flow_id = $1 AND a.status = 'approved' AND a.deleted_at IS NULL
     ORDER BY av.version DESC`,
    [flowId],
  );

  // Build prompt
  const prompt = loadPrompt(artifactType, {
    flow,
    previousArtifacts: prevArtifacts.rows,
    feedback,
  });

  // Call Claude
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON from response
  let content: { sections: unknown[] };
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    content = jsonMatch ? JSON.parse(jsonMatch[0]) : { sections: [{ id: 'content', title: artifactType, content: text }] };
  } catch {
    content = { sections: [{ id: 'content', title: artifactType, content: text }] };
  }

  // Get next version number
  const lastVersion = await db.query(
    'SELECT COALESCE(MAX(version), 0) as max FROM artifact_versions WHERE artifact_id = $1',
    [artifactId],
  );
  const nextVersion = lastVersion.rows[0].max + 1;

  // Store version
  const versionId = generateId('artv');
  await db.query(
    `INSERT INTO artifact_versions (id, artifact_id, org_id, version, content, content_text, generated_by, token_usage)
     VALUES ($1, $2, $3, $4, $5, $6, 'ai', $7)`,
    [
      versionId, artifactId, orgId, nextVersion,
      JSON.stringify(content), text, JSON.stringify({
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        model: 'claude-sonnet-4-6',
      }),
    ],
  );

  eventBus.emit('artifact.generated', {
    org_id: orgId, entity_type: 'artifact', entity_id: artifactId,
    event_type: 'artifact.generated', actor_id: userId,
    data: { version: nextVersion },
  });

  return { artifact_id: artifactId, version: nextVersion };
}
