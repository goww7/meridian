# Meridian — AI Agent System

## Overview

Meridian uses the Anthropic Claude API to generate structured artifacts at each stage of the delivery flow. AI is a **co-pilot** — it generates drafts that humans review, refine, and approve.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  API Route  │────▶│  Job Queue   │────▶│  AI Worker    │
│  (enqueue)  │     │  (BullMQ)    │     │  (process)    │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                              ┌──────────┐ ┌──────────┐ ┌──────────┐
                              │ Context  │ │ Prompt   │ │ Claude   │
                              │ Builder  │ │ Template │ │   API    │
                              └──────────┘ └──────────┘ └──────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │  Store as    │
                                          │  draft       │
                                          │  version     │
                                          └──────────────┘
```

## Artifact Types

### 1. Assessment

**Generated at:** Assess stage
**Purpose:** Evaluate feasibility, risks, complexity, and sensitivity of a proposed flow.

**Input context:**
- Flow title and description
- Org industry/domain (from org settings)
- Tags and metadata
- Similar past flows (if available)

**Output structure:**
```json
{
  "sections": [
    {
      "id": "executive_summary",
      "title": "Executive Summary",
      "content": "..."
    },
    {
      "id": "problem_statement",
      "title": "Problem Statement",
      "content": "..."
    },
    {
      "id": "feasibility_analysis",
      "title": "Feasibility Analysis",
      "content": "...",
      "subsections": [
        { "id": "technical_feasibility", "title": "Technical Feasibility", "content": "..." },
        { "id": "resource_feasibility", "title": "Resource Feasibility", "content": "..." }
      ]
    },
    {
      "id": "risk_assessment",
      "title": "Risk Assessment",
      "content": "...",
      "risks": [
        { "id": "r1", "description": "...", "likelihood": "medium", "impact": "high", "mitigation": "..." }
      ]
    },
    {
      "id": "complexity_estimate",
      "title": "Complexity Estimate",
      "content": "...",
      "score": "high",
      "factors": ["...", "..."]
    },
    {
      "id": "data_sensitivity",
      "title": "Data Sensitivity Classification",
      "content": "...",
      "classification": "high",
      "data_types": ["PII", "financial"]
    },
    {
      "id": "recommendation",
      "title": "Recommendation",
      "content": "...",
      "proceed": true,
      "conditions": ["...", "..."]
    }
  ]
}
```

### 2. PRD (Product Requirements Document)

**Generated at:** Plan stage
**Purpose:** Define what to build, why, and how success is measured.

**Input context:**
- Flow details
- Approved assessment
- Org domain context
- Existing initiatives/objectives (if any)

**Output structure:**
```json
{
  "sections": [
    { "id": "overview", "title": "Overview", "content": "..." },
    { "id": "goals", "title": "Goals & Objectives", "content": "...",
      "objectives": [
        { "id": "o1", "title": "...", "success_criteria": "...", "measurable": true }
      ]
    },
    { "id": "user_stories", "title": "User Stories", "content": "...",
      "stories": [
        { "id": "us1", "persona": "...", "action": "...", "benefit": "..." }
      ]
    },
    { "id": "requirements", "title": "Requirements", "content": "...",
      "requirements": [
        {
          "id": "r1", "title": "...", "description": "...",
          "type": "functional", "priority": "must",
          "acceptance_criteria": [
            { "description": "...", "testable": true }
          ]
        }
      ]
    },
    { "id": "non_functional", "title": "Non-Functional Requirements", "content": "...",
      "requirements": [...]
    },
    { "id": "out_of_scope", "title": "Out of Scope", "content": "...", "items": ["..."] },
    { "id": "dependencies", "title": "Dependencies", "content": "...", "deps": ["..."] },
    { "id": "success_metrics", "title": "Success Metrics", "content": "...",
      "metrics": [
        { "name": "...", "target": "...", "measurement": "..." }
      ]
    }
  ]
}
```

**Post-generation action:** When a PRD is approved, its objectives and requirements are automatically created as `objectives` and `requirements` entities linked to the flow.

### 3. Architecture Document

**Generated at:** Plan stage
**Purpose:** Technical architecture and design decisions.

**Input context:**
- Flow details
- Approved PRD (requirements, constraints)
- Org tech stack preferences (from settings)

**Output structure:**
```json
{
  "sections": [
    { "id": "overview", "title": "Architecture Overview", "content": "..." },
    { "id": "system_context", "title": "System Context", "content": "...", "diagram_description": "..." },
    { "id": "components", "title": "Component Design", "content": "...",
      "components": [
        { "name": "...", "responsibility": "...", "technology": "...", "interfaces": ["..."] }
      ]
    },
    { "id": "data_model", "title": "Data Model", "content": "...",
      "entities": [
        { "name": "...", "fields": [...], "relationships": [...] }
      ]
    },
    { "id": "api_design", "title": "API Design", "content": "...",
      "endpoints": [
        { "method": "POST", "path": "...", "description": "..." }
      ]
    },
    { "id": "security", "title": "Security Considerations", "content": "..." },
    { "id": "scalability", "title": "Scalability & Performance", "content": "..." },
    { "id": "decisions", "title": "Architecture Decision Records", "content": "...",
      "adrs": [
        { "id": "adr1", "title": "...", "context": "...", "decision": "...", "consequences": "..." }
      ]
    }
  ]
}
```

### 4. Test Plan

**Generated at:** Build stage
**Purpose:** Comprehensive testing strategy derived from requirements.

**Input context:**
- Flow requirements and acceptance criteria
- Architecture document
- Data sensitivity classification

**Output structure:**
```json
{
  "sections": [
    { "id": "strategy", "title": "Test Strategy", "content": "..." },
    { "id": "scope", "title": "Test Scope", "content": "..." },
    { "id": "test_cases", "title": "Test Cases", "content": "...",
      "cases": [
        {
          "id": "tc1",
          "requirement_id": "r1",
          "title": "...",
          "type": "integration",
          "steps": ["..."],
          "expected_result": "...",
          "priority": "high"
        }
      ]
    },
    { "id": "security_tests", "title": "Security Tests", "content": "...", "cases": [...] },
    { "id": "performance_tests", "title": "Performance Tests", "content": "...", "cases": [...] },
    { "id": "environments", "title": "Test Environments", "content": "..." },
    { "id": "exit_criteria", "title": "Exit Criteria", "content": "...",
      "criteria": [
        { "metric": "coverage", "target": ">= 80%", "blocking": true },
        { "metric": "critical_bugs", "target": "0", "blocking": true }
      ]
    }
  ]
}
```

### 5. Runbook

**Generated at:** Release stage
**Purpose:** Deployment and operational playbook.

**Input context:**
- Flow details and architecture
- Deployment configuration
- Risk assessment from assessment
- Previous incident data (if available)

**Output structure:**
```json
{
  "sections": [
    { "id": "pre_deploy", "title": "Pre-Deployment Checklist", "content": "...",
      "checklist": [
        { "item": "...", "required": true }
      ]
    },
    { "id": "deploy_steps", "title": "Deployment Steps", "content": "...",
      "steps": [
        { "order": 1, "action": "...", "command": "...", "verification": "..." }
      ]
    },
    { "id": "rollback", "title": "Rollback Plan", "content": "...",
      "steps": [
        { "order": 1, "action": "...", "command": "..." }
      ]
    },
    { "id": "monitoring", "title": "Post-Deploy Monitoring", "content": "...",
      "checks": [
        { "metric": "...", "threshold": "...", "action": "..." }
      ]
    },
    { "id": "incidents", "title": "Incident Response", "content": "...",
      "scenarios": [
        { "scenario": "...", "detection": "...", "response": "...", "escalation": "..." }
      ]
    }
  ]
}
```

## Context Building

The context builder assembles relevant information for the AI prompt:

```typescript
// ai/context-builder.ts
interface GenerationContext {
  flow: Flow;
  org: { name: string; industry?: string; domain?: string };
  artifacts: Artifact[];           // previously approved artifacts for this flow
  requirements: Requirement[];     // existing requirements
  graph_neighbors: GraphNode[];    // related flows, dependencies
  feedback?: string;               // user feedback for regeneration
}

async function buildContext(flowId: string, artifactType: string): Promise<GenerationContext> {
  // 1. Load flow with all relations
  // 2. Load previously approved artifacts (e.g., assessment for PRD generation)
  // 3. Query graph for related entities
  // 4. Trim to fit within context budget (reserve ~60% of context for generation)
  // 5. Return structured context
}
```

**Context budget management:**
- Total context window: 200K tokens (Claude model)
- Reserved for system prompt + output: ~80K tokens
- Available for context: ~120K tokens
- Priority order: flow details > approved artifacts > requirements > graph neighbors

## Prompt Architecture

Prompts are stored as template files in `apps/api/src/ai/prompts/`:

```
prompts/
├── system.txt              # Shared system prompt (Meridian role, output format)
├── assessment.txt          # Assessment generation prompt
├── prd.txt                 # PRD generation prompt
├── architecture.txt        # Architecture doc prompt
├── test-plan.txt           # Test plan prompt
├── runbook.txt             # Runbook prompt
└── regenerate.txt          # Regeneration with feedback prompt
```

**Prompt template structure:**

```
{{system_prompt}}

You are generating a {{artifact_type}} for a software delivery flow.

## Flow Context
Title: {{flow.title}}
Description: {{flow.description}}
Priority: {{flow.priority}}
Sensitivity: {{flow.sensitivity}}
Stage: {{flow.current_stage}}

## Organization Context
Organization: {{org.name}}
{{#if org.industry}}Industry: {{org.industry}}{{/if}}

{{#if previous_artifacts}}
## Previously Approved Artifacts
{{#each previous_artifacts}}
### {{this.type}}: {{this.title}}
{{this.content_text}}
{{/each}}
{{/if}}

{{#if feedback}}
## User Feedback
The previous version received this feedback. Incorporate it:
{{feedback}}
{{/if}}

## Instructions
Generate a comprehensive {{artifact_type}} following the exact JSON structure specified.
{{artifact_specific_instructions}}

Respond with valid JSON only.
```

## AI Worker Implementation

```typescript
// ai/worker.ts
import { Worker } from 'bullmq';
import Anthropic from '@anthropic-ai/sdk';

const worker = new Worker('ai-generation', async (job) => {
  const { flowId, artifactType, artifactId, feedback, orgId } = job.data;

  // 1. Build context
  const context = await buildContext(flowId, artifactType);

  // 2. Render prompt
  const prompt = await renderPrompt(artifactType, context, feedback);

  // 3. Call Claude API
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
    system: systemPrompt,
  });

  // 4. Parse and validate response
  const content = JSON.parse(response.content[0].text);
  validateArtifactStructure(artifactType, content);

  // 5. Store as new artifact version
  const version = await createArtifactVersion({
    artifactId,
    orgId,
    content,
    contentText: renderMarkdown(content),
    generatedBy: 'ai',
    promptHash: hashPrompt(prompt),
    tokenUsage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      model: 'claude-sonnet-4-6',
    },
  });

  // 6. Emit event
  eventBus.emit('artifact.version_created', {
    artifactId,
    version: version.version,
    generatedBy: 'ai',
    orgId,
  });

  return { artifactId, version: version.version };
}, {
  connection: redis,
  concurrency: 5,
  limiter: { max: 10, duration: 60_000 }, // 10 jobs per minute per queue
});
```

## Quality & Feedback Loop

### Quality Scoring

When users approve or reject an artifact, we track:

```json
{
  "artifact_id": "art_01HX...",
  "version": 1,
  "action": "approved",           // or "rejected", "regenerated"
  "feedback": "...",               // optional
  "time_to_decision_seconds": 300, // how long before user decided
  "edits_before_approval": 2       // how many manual edits before approving
}
```

**Quality signals:**
- **Approved on first version** = high quality
- **Regenerated with feedback** = medium quality (prompt needs tuning)
- **Rejected** = low quality (investigate prompt/context)
- **Heavy manual edits** = AI got the structure but not the content

### Token Usage Tracking

Per-org metering for billing:

```sql
-- Aggregate monthly usage
SELECT
  org_id,
  date_trunc('month', created_at) as month,
  SUM((token_usage->>'input_tokens')::int) as input_tokens,
  SUM((token_usage->>'output_tokens')::int) as output_tokens,
  COUNT(*) as generation_count
FROM artifact_versions
WHERE generated_by = 'ai'
GROUP BY org_id, month;
```

## Model Selection Strategy

| Artifact Type | Model | Reasoning |
|---------------|-------|-----------|
| Assessment | claude-sonnet-4-6 | Good balance of quality and speed |
| PRD | claude-sonnet-4-6 | Structured output, requirements extraction |
| Architecture | claude-sonnet-4-6 | Technical depth needed |
| Test Plan | claude-sonnet-4-6 | Requirement-to-test mapping |
| Runbook | claude-sonnet-4-6 | Operational playbooks |
| Regeneration | claude-sonnet-4-6 | Needs to understand feedback nuance |

Default to `claude-sonnet-4-6` for all generation tasks. Upgrade to `claude-opus-4-6` for enterprise customers or when quality scores are consistently low for an org.

## Error Handling

| Error | Strategy |
|-------|----------|
| API rate limit | Exponential backoff, max 3 retries |
| Invalid JSON response | Retry with stricter prompt instructions |
| Context too large | Trim older artifacts, summarize graph neighbors |
| API timeout | Retry once, then fail with user notification |
| Content policy violation | Log, notify admin, skip generation |
