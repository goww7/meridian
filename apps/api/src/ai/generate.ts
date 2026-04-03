import { db } from '../infra/db/client.js';
import { generateId } from '../infra/id.js';
import { eventBus } from '../infra/events.js';
import { loadPrompt } from './prompts.js';
import { getLlmProviderForOrg } from './providers/index.js';

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

  // Call LLM via provider abstraction (org DB connection → env var fallback)
  const { provider, model } = await getLlmProviderForOrg(orgId);
  const response = await provider.generate(
    [{ role: 'user', content: prompt }],
    { model, maxTokens: 8192 },
  );

  // Parse JSON from response
  let content: { sections: unknown[] };
  try {
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    content = jsonMatch ? JSON.parse(jsonMatch[0]) : { sections: [{ id: 'content', title: artifactType, content: response.text }] };
  } catch {
    content = { sections: [{ id: 'content', title: artifactType, content: response.text }] };
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
      JSON.stringify(content), response.text, JSON.stringify(response.usage),
    ],
  );

  eventBus.emit('artifact.generated', {
    org_id: orgId, entity_type: 'artifact', entity_id: artifactId,
    event_type: 'artifact.generated', actor_id: userId,
    data: { version: nextVersion },
  });

  return { artifact_id: artifactId, version: nextVersion };
}
