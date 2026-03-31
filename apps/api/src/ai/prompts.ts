interface PromptContext {
  flow: Record<string, unknown>;
  previousArtifacts: Array<{ type: string; title: string; content_text: string }>;
  feedback?: string;
}

const PROMPTS: Record<string, (ctx: PromptContext) => string> = {
  assessment: (ctx) => `You are generating a technical assessment for a software delivery flow.

## Flow
Title: ${ctx.flow.title}
Description: ${ctx.flow.description || 'N/A'}
Priority: ${ctx.flow.priority}
Sensitivity: ${ctx.flow.sensitivity}

${ctx.feedback ? `## Feedback on previous version\n${ctx.feedback}\n` : ''}

Generate a comprehensive assessment as JSON with this structure:
{
  "sections": [
    { "id": "executive_summary", "title": "Executive Summary", "content": "..." },
    { "id": "problem_statement", "title": "Problem Statement", "content": "..." },
    { "id": "feasibility", "title": "Feasibility Analysis", "content": "..." },
    { "id": "risk_assessment", "title": "Risk Assessment", "content": "...", "risks": [{ "description": "...", "likelihood": "low|medium|high", "impact": "low|medium|high", "mitigation": "..." }] },
    { "id": "complexity", "title": "Complexity Estimate", "content": "...", "score": "low|medium|high" },
    { "id": "recommendation", "title": "Recommendation", "content": "...", "proceed": true }
  ]
}

Respond with valid JSON only.`,

  prd: (ctx) => `You are generating a Product Requirements Document for a software delivery flow.

## Flow
Title: ${ctx.flow.title}
Description: ${ctx.flow.description || 'N/A'}
Priority: ${ctx.flow.priority}
Sensitivity: ${ctx.flow.sensitivity}

${ctx.previousArtifacts.length > 0 ? `## Previously Approved Artifacts\n${ctx.previousArtifacts.map((a) => `### ${a.type}: ${a.title}\n${a.content_text}`).join('\n\n')}` : ''}

${ctx.feedback ? `## Feedback on previous version\n${ctx.feedback}\n` : ''}

Generate a comprehensive PRD as JSON with this structure:
{
  "sections": [
    { "id": "overview", "title": "Overview", "content": "..." },
    { "id": "goals", "title": "Goals & Objectives", "content": "...", "objectives": [{ "title": "...", "success_criteria": "..." }] },
    { "id": "requirements", "title": "Requirements", "content": "...", "requirements": [{ "title": "...", "description": "...", "type": "functional|non_functional|security", "priority": "must|should|could", "acceptance_criteria": [{ "description": "...", "testable": true }] }] },
    { "id": "out_of_scope", "title": "Out of Scope", "content": "..." },
    { "id": "success_metrics", "title": "Success Metrics", "content": "..." }
  ]
}

Respond with valid JSON only.`,

  architecture: (ctx) => `You are generating an Architecture Document for a software delivery flow.

## Flow
Title: ${ctx.flow.title}
Description: ${ctx.flow.description || 'N/A'}

${ctx.previousArtifacts.length > 0 ? `## Previously Approved Artifacts\n${ctx.previousArtifacts.map((a) => `### ${a.type}: ${a.title}\n${a.content_text}`).join('\n\n')}` : ''}

${ctx.feedback ? `## Feedback\n${ctx.feedback}\n` : ''}

Generate an architecture document as JSON with sections: overview, components, data_model, api_design, security, scalability, decisions. Respond with valid JSON only.`,

  test_plan: (ctx) => `You are generating a Test Plan for a software delivery flow.

## Flow
Title: ${ctx.flow.title}

${ctx.previousArtifacts.length > 0 ? `## Context\n${ctx.previousArtifacts.map((a) => `### ${a.type}: ${a.title}\n${a.content_text}`).join('\n\n')}` : ''}

${ctx.feedback ? `## Feedback\n${ctx.feedback}\n` : ''}

Generate a test plan as JSON with sections: strategy, scope, test_cases (array), security_tests, performance_tests, exit_criteria. Respond with valid JSON only.`,

  runbook: (ctx) => `You are generating a Runbook for a software delivery flow.

## Flow
Title: ${ctx.flow.title}

${ctx.previousArtifacts.length > 0 ? `## Context\n${ctx.previousArtifacts.map((a) => `### ${a.type}: ${a.title}\n${a.content_text}`).join('\n\n')}` : ''}

${ctx.feedback ? `## Feedback\n${ctx.feedback}\n` : ''}

Generate a runbook as JSON with sections: pre_deploy, deploy_steps, rollback, monitoring, incidents. Respond with valid JSON only.`,
};

export function loadPrompt(artifactType: string, context: PromptContext): string {
  const builder = PROMPTS[artifactType];
  if (!builder) {
    return `Generate a document of type "${artifactType}" for the flow: ${context.flow.title}. Respond with JSON containing a "sections" array.`;
  }
  return builder(context);
}
