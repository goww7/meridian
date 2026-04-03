import { db } from '../infra/db/client.js';
import { generateId } from '../infra/id.js';
import { eventBus } from '../infra/events.js';
import { getLlmProviderForOrg } from './providers/index.js';

interface KickstartInput {
  jobId: string;
  orgId: string;
  flowId: string;
  userId: string;
}

interface KickstartTask {
  title: string;
  description: string;
}

interface KickstartRequirement {
  title: string;
  description: string;
  type: 'functional' | 'non_functional' | 'security' | 'compliance';
  priority: 'must' | 'should' | 'could' | 'wont';
  tasks: KickstartTask[];
}

interface KickstartObjective {
  title: string;
  description: string;
  success_criteria: string;
  requirements: KickstartRequirement[];
}

interface KickstartInitiative {
  title: string;
  description: string;
  objectives: KickstartObjective[];
}

interface KickstartResponse {
  initiatives: KickstartInitiative[];
}

export async function kickstartFlow(input: KickstartInput): Promise<{ initiatives: number; objectives: number; requirements: number; tasks: number }> {
  const { orgId, flowId, userId } = input;

  // Load flow data
  const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND org_id = $2', [flowId, orgId]);
  const flow = flowResult.rows[0];
  if (!flow) {
    throw new Error(`Flow ${flowId} not found`);
  }

  // Load existing artifacts for context
  const artifactsResult = await db.query(
    `SELECT a.type, a.title, av.content_text
     FROM artifacts a
     JOIN artifact_versions av ON av.artifact_id = a.id
     WHERE a.flow_id = $1 AND a.status = 'approved' AND a.deleted_at IS NULL
     ORDER BY av.version DESC`,
    [flowId],
  );

  // Build the prompt
  const artifactContext = artifactsResult.rows.length > 0
    ? `\n\nExisting approved artifacts for additional context:\n${artifactsResult.rows.map((a: { type: string; title: string; content_text: string }) => `- ${a.type}: ${a.title}\n  ${a.content_text?.substring(0, 500) || '(no content)'}`).join('\n')}`
    : '';

  const prompt = `You are a senior delivery architect helping break down a software delivery flow into a structured hierarchy of initiatives, objectives, requirements, and tasks.

## Flow Details
- **Title:** ${flow.title}
- **Description:** ${flow.description || 'No description provided'}
- **Priority:** ${flow.priority || 'medium'}
- **Sensitivity:** ${flow.sensitivity || 'standard'}
- **Current Stage:** ${flow.current_stage || 'assess'}${artifactContext}

## Your Task

Analyze the flow above and generate a comprehensive breakdown. Think carefully about the domain, scope, and complexity implied by the title and description. Produce a realistic, actionable plan that a delivery team could immediately start executing.

### Guidelines
- Generate **2-4 initiatives** that represent major workstreams or themes
- Each initiative should have **2-3 objectives** with measurable success criteria
- Each objective should have **2-5 requirements** categorized by type and prioritized using MoSCoW
- Each requirement should have **1-3 concrete tasks** that a developer or team member can pick up

### Requirement Types
- \`functional\` — Feature or capability the system must provide
- \`non_functional\` — Performance, scalability, reliability, usability concerns
- \`security\` — Authentication, authorization, data protection, vulnerability mitigation
- \`compliance\` — Regulatory, audit, legal, or policy requirements

### Priority Levels (MoSCoW)
- \`must\` — Critical for delivery, non-negotiable
- \`should\` — Important but not blocking
- \`could\` — Nice to have if time permits
- \`wont\` — Explicitly out of scope for this iteration

### Quality Standards
- Titles should be concise but descriptive (5-12 words)
- Descriptions should be 1-3 sentences explaining the "what" and "why"
- Success criteria should be measurable and verifiable
- Tasks should be specific enough to estimate (1-5 days of work each)
- Ensure good coverage across functional, non-functional, security, and compliance concerns
- Prioritize realistically — not everything should be "must"

Respond with ONLY valid JSON in this exact structure (no markdown, no explanation):

{
  "initiatives": [
    {
      "title": "...",
      "description": "...",
      "objectives": [
        {
          "title": "...",
          "description": "...",
          "success_criteria": "...",
          "requirements": [
            {
              "title": "...",
              "description": "...",
              "type": "functional|non_functional|security|compliance",
              "priority": "must|should|could|wont",
              "tasks": [
                { "title": "...", "description": "..." }
              ]
            }
          ]
        }
      ]
    }
  ]
}`;

  // Call LLM
  const { provider, model } = await getLlmProviderForOrg(orgId);
  const response = await provider.generate(
    [{ role: 'user', content: prompt }],
    { model, maxTokens: 8192 },
  );

  // Parse JSON response
  let parsed: KickstartResponse;
  try {
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in LLM response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(`Failed to parse kickstart response: ${(err as Error).message}`);
  }

  if (!parsed.initiatives || !Array.isArray(parsed.initiatives) || parsed.initiatives.length === 0) {
    throw new Error('LLM response contained no initiatives');
  }

  // Bulk-insert all entities
  const counts = { initiatives: 0, objectives: 0, requirements: 0, tasks: 0 };

  for (const init of parsed.initiatives) {
    const initId = generateId('init');
    await db.query(
      'INSERT INTO initiatives (id, org_id, flow_id, title, description) VALUES ($1, $2, $3, $4, $5)',
      [initId, orgId, flowId, init.title, init.description],
    );
    counts.initiatives++;

    for (const obj of init.objectives || []) {
      const objId = generateId('obj');
      await db.query(
        'INSERT INTO objectives (id, org_id, initiative_id, title, description, success_criteria) VALUES ($1, $2, $3, $4, $5, $6)',
        [objId, orgId, initId, obj.title, obj.description, obj.success_criteria],
      );
      counts.objectives++;

      for (const req of obj.requirements || []) {
        const reqId = generateId('req');
        await db.query(
          'INSERT INTO requirements (id, org_id, flow_id, objective_id, title, description, type, priority) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [reqId, orgId, flowId, objId, req.title, req.description, req.type, req.priority],
        );
        counts.requirements++;

        for (const task of req.tasks || []) {
          const taskId = generateId('task');
          await db.query(
            'INSERT INTO tasks (id, org_id, flow_id, requirement_id, title, description) VALUES ($1, $2, $3, $4, $5, $6)',
            [taskId, orgId, flowId, reqId, task.title, task.description],
          );
          counts.tasks++;
        }
      }
    }
  }

  // Emit event
  eventBus.emit('flow.kickstarted', {
    org_id: orgId,
    entity_type: 'flow',
    entity_id: flowId,
    event_type: 'flow.kickstarted',
    actor_id: userId,
    data: { counts },
  });

  return counts;
}
