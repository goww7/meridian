import { db } from '../infra/db/client.js';
import { generateId } from '../infra/id.js';
import { eventBus } from '../infra/events.js';
import { getLlmProviderForOrg } from './providers/index.js';

interface RepoKickstartInput {
  jobId: string;
  orgId: string;
  flowId: string;
  userId: string;
  repoUrl: string;
}

// ── GitHub content fetcher (public repos, no auth needed) ──

async function fetchRepoContent(repoUrl: string): Promise<string> {
  // Parse owner/repo from URL
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) throw new Error('Invalid GitHub URL. Expected: https://github.com/owner/repo');
  const [, owner, repo] = match;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Meridian-Bot',
  };

  // Use GitHub token if available (for private repos / rate limits)
  const ghToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PRIVATE_KEY;
  if (ghToken && !ghToken.startsWith('-----')) {
    headers['Authorization'] = `Bearer ${ghToken}`;
  }

  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

  async function ghFetch(path: string): Promise<any> {
    const res = await fetch(`${apiBase}${path}`, { headers });
    if (!res.ok) {
      if (res.status === 404) return null;
      if (res.status === 403) return null; // rate limited
      return null;
    }
    return res.json();
  }

  async function ghFetchRaw(path: string): Promise<string | null> {
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`, {
      headers: { 'User-Agent': 'Meridian-Bot' },
    });
    if (!res.ok) return null;
    return res.text();
  }

  // Fetch repo metadata
  const repoData = await ghFetch('');
  if (!repoData) throw new Error(`Could not access repository ${owner}/${repo}. Make sure it exists and is accessible.`);

  // Fetch file tree (recursive, first level + key dirs)
  const tree = await ghFetch('/git/trees/HEAD?recursive=1');
  const files: string[] = tree?.tree
    ?.filter((f: any) => f.type === 'blob')
    ?.map((f: any) => f.path)
    ?.slice(0, 500) || [];

  // Fetch key files
  const keyFiles = [
    'README.md', 'readme.md', 'README.rst',
    'package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'setup.py', 'pom.xml', 'build.gradle',
    'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
    '.env.example', '.env.sample',
    'CONTRIBUTING.md', 'ARCHITECTURE.md', 'CLAUDE.md',
    'turbo.json', 'nx.json', 'lerna.json',
    'tsconfig.json', 'vite.config.ts', 'next.config.js', 'next.config.ts',
    'openapi.yaml', 'openapi.json', 'swagger.json',
  ];

  const fileContents: Record<string, string> = {};
  const fetchPromises = keyFiles.map(async (f) => {
    if (files.includes(f) || files.includes(f.toLowerCase())) {
      const content = await ghFetchRaw(f);
      if (content && content.length < 15_000) {
        fileContents[f] = content;
      } else if (content) {
        fileContents[f] = content.substring(0, 15_000) + '\n... (truncated)';
      }
    }
  });
  await Promise.all(fetchPromises);

  // Also try to get src/ or app/ structure for context
  const srcDirs = ['src', 'app', 'lib', 'cmd', 'internal', 'packages', 'apps', 'services', 'modules'];
  const dirStructure: string[] = [];
  for (const dir of srcDirs) {
    const dirFiles = files.filter((f: string) => f.startsWith(`${dir}/`));
    if (dirFiles.length > 0) {
      dirStructure.push(`\n## ${dir}/`);
      // Show first 50 files per dir
      for (const f of dirFiles.slice(0, 50)) {
        dirStructure.push(`  ${f}`);
      }
      if (dirFiles.length > 50) {
        dirStructure.push(`  ... and ${dirFiles.length - 50} more files`);
      }
    }
  }

  // Fetch recent issues (open, last 20)
  const issues = await ghFetch('/issues?state=open&per_page=20&sort=updated');
  const issueList = (issues || [])
    .filter((i: any) => !i.pull_request)
    .slice(0, 15)
    .map((i: any) => `- #${i.number}: ${i.title} [${i.labels?.map((l: any) => l.name).join(', ') || 'no labels'}]`)
    .join('\n');

  // Fetch recent PRs (open)
  const prs = await ghFetch('/pulls?state=open&per_page=10&sort=updated');
  const prList = (prs || [])
    .slice(0, 10)
    .map((p: any) => `- PR #${p.number}: ${p.title} (${p.head?.ref || '?'} → ${p.base?.ref || '?'})`)
    .join('\n');

  // Fetch languages
  const languages = await ghFetch('/languages');
  const langStr = languages ? Object.entries(languages).map(([l, b]) => `${l}: ${b}`).join(', ') : 'unknown';

  // Build context document
  const sections: string[] = [];

  sections.push(`# Repository: ${owner}/${repo}`);
  sections.push(`- **Description:** ${repoData.description || 'No description'}`);
  sections.push(`- **Languages:** ${langStr}`);
  sections.push(`- **Stars:** ${repoData.stargazers_count || 0} | **Forks:** ${repoData.forks_count || 0}`);
  sections.push(`- **Default Branch:** ${repoData.default_branch || 'main'}`);
  sections.push(`- **Topics:** ${repoData.topics?.join(', ') || 'none'}`);
  sections.push(`- **Total Files:** ${files.length}`);

  if (Object.keys(fileContents).length > 0) {
    sections.push('\n---\n# Key Files\n');
    for (const [path, content] of Object.entries(fileContents)) {
      sections.push(`## ${path}\n\`\`\`\n${content}\n\`\`\`\n`);
    }
  }

  if (dirStructure.length > 0) {
    sections.push('\n---\n# Project Structure\n');
    sections.push(dirStructure.join('\n'));
  }

  if (issueList) {
    sections.push(`\n---\n# Open Issues\n${issueList}`);
  }

  if (prList) {
    sections.push(`\n---\n# Open Pull Requests\n${prList}`);
  }

  return sections.join('\n');
}

// ── Main kickstart from repo ──

export async function repoKickstartFlow(input: RepoKickstartInput) {
  const { orgId, flowId, userId, repoUrl } = input;

  const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND org_id = $2', [flowId, orgId]);
  const flow = flowResult.rows[0];
  if (!flow) throw new Error(`Flow ${flowId} not found`);

  // Fetch repo content
  const repoContext = await fetchRepoContent(repoUrl);

  // ── Phase 1: Generate initiatives, objectives, requirements, tasks ──

  const structurePrompt = `You are a senior delivery architect. You have been given a GitHub repository to analyze. Your job is to create a comprehensive delivery plan by analyzing the codebase, its architecture, dependencies, open issues, and documentation.

## Repository Analysis
${repoContext}

## Flow Details
- **Title:** ${flow.title}
- **Description:** ${flow.description || 'Imported from GitHub repository'}

## Your Task

Based on the repository analysis above, generate a comprehensive delivery breakdown. Consider:
- The actual architecture, tech stack, and patterns used in the codebase
- Open issues and PRs that indicate ongoing work or technical debt
- Security, testing, deployment, and documentation gaps you can identify
- Performance, scalability, and reliability concerns based on the code structure

### Guidelines
- Generate **3-5 initiatives** that represent major workstreams (e.g., "Core Feature Development", "Security Hardening", "Testing & Quality", "Infrastructure & DevOps", "Documentation & DX")
- Each initiative should have **2-4 objectives** with measurable success criteria based on what you see in the code
- Each objective should have **3-6 requirements** categorized by type and prioritized using MoSCoW
- Each requirement should have **2-4 concrete tasks** referencing actual files, modules, or patterns from the repo
- Reference actual file paths, module names, and patterns from the codebase in task descriptions

### Requirement Types
- \`functional\` — Feature or capability
- \`non_functional\` — Performance, scalability, reliability
- \`security\` — Auth, data protection, vulnerabilities
- \`compliance\` — Regulatory, audit, legal

### Priority Levels (MoSCoW)
- \`must\` — Critical, non-negotiable
- \`should\` — Important but not blocking
- \`could\` — Nice to have
- \`wont\` — Out of scope for now

Respond with ONLY valid JSON:
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

  const { provider, model } = await getLlmProviderForOrg(orgId);

  const structureResponse = await provider.generate(
    [{ role: 'user', content: structurePrompt }],
    { model, maxTokens: 16384 },
  );

  // Parse structure
  let parsed: { initiatives: any[] };
  try {
    const jsonMatch = structureResponse.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(`Failed to parse repo kickstart response: ${(err as Error).message}`);
  }

  if (!parsed.initiatives?.length) throw new Error('No initiatives generated');

  // Insert all entities
  const counts = { initiatives: 0, objectives: 0, requirements: 0, tasks: 0, artifacts: 0 };

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

  // ── Phase 2: Generate artifacts (assessment, prd, architecture, test_plan) ──

  const artifactTypes = ['assessment', 'prd', 'architecture', 'test_plan'];

  for (const artType of artifactTypes) {
    const artId = generateId('art');
    const versionId = generateId('artv');
    const title = artType === 'prd' ? 'Product Requirements Document'
      : artType === 'test_plan' ? 'Test Plan'
      : artType.charAt(0).toUpperCase() + artType.slice(1);

    const artPrompt = buildArtifactPrompt(artType, flow, repoContext, parsed);

    let artResponse;
    try {
      artResponse = await provider.generate(
        [{ role: 'user', content: artPrompt }],
        { model, maxTokens: 8192 },
      );
    } catch {
      continue; // Skip failed artifacts, don't block the whole process
    }

    let content: any;
    try {
      const jsonMatch = artResponse.text.match(/\{[\s\S]*\}/);
      content = jsonMatch ? JSON.parse(jsonMatch[0]) : { sections: [{ id: 'content', title, content: artResponse.text }] };
    } catch {
      content = { sections: [{ id: 'content', title, content: artResponse.text }] };
    }

    await db.query(
      `INSERT INTO artifacts (id, org_id, flow_id, type, title, status) VALUES ($1, $2, $3, $4, $5, 'draft')`,
      [artId, orgId, flowId, artType, title],
    );

    await db.query(
      `INSERT INTO artifact_versions (id, artifact_id, org_id, version, content, content_text, generated_by, token_usage)
       VALUES ($1, $2, $3, 1, $4, $5, 'ai', $6)`,
      [versionId, artId, orgId, JSON.stringify(content), artResponse.text, JSON.stringify(artResponse.usage)],
    );

    counts.artifacts++;
  }

  // Update flow description if it was empty
  if (!flow.description) {
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    const repoName = match ? `${match[1]}/${match[2]}` : repoUrl;
    await db.query(
      'UPDATE flows SET description = $1 WHERE id = $2',
      [`Generated from GitHub repository: ${repoName}`, flowId],
    );
  }

  eventBus.emit('flow.kickstarted', {
    org_id: orgId,
    entity_type: 'flow',
    entity_id: flowId,
    event_type: 'flow.repo_kickstarted',
    actor_id: userId,
    data: { counts, repo_url: repoUrl },
  });

  return counts;
}

// ── Artifact prompt builders ──

function buildArtifactPrompt(type: string, flow: any, repoContext: string, structure: { initiatives: any[] }): string {
  const structureSummary = structure.initiatives.map((i) =>
    `### ${i.title}\n${i.description}\n${(i.objectives || []).map((o: any) =>
      `  - ${o.title}: ${(o.requirements || []).length} requirements`
    ).join('\n')}`
  ).join('\n\n');

  const base = `You are generating a ${type} document based on analysis of a real GitHub repository.

## Repository
${repoContext.substring(0, 20_000)}

## Flow: ${flow.title}
${flow.description || ''}

## Generated Delivery Structure
${structureSummary}

`;

  switch (type) {
    case 'assessment':
      return base + `Generate a technical assessment as JSON:
{
  "sections": [
    { "id": "executive_summary", "title": "Executive Summary", "content": "..." },
    { "id": "problem_statement", "title": "Problem Statement", "content": "..." },
    { "id": "tech_stack", "title": "Technology Stack Analysis", "content": "..." },
    { "id": "architecture", "title": "Architecture Overview", "content": "..." },
    { "id": "risk_assessment", "title": "Risk Assessment", "content": "...", "risks": [{ "description": "...", "likelihood": "low|medium|high", "impact": "low|medium|high", "mitigation": "..." }] },
    { "id": "complexity", "title": "Complexity Estimate", "content": "...", "score": "low|medium|high" },
    { "id": "recommendation", "title": "Recommendation", "content": "...", "proceed": true }
  ]
}
Respond with valid JSON only.`;

    case 'prd':
      return base + `Generate a PRD as JSON:
{
  "sections": [
    { "id": "overview", "title": "Overview", "content": "..." },
    { "id": "goals", "title": "Goals & Objectives", "content": "...", "objectives": [{ "title": "...", "success_criteria": "..." }] },
    { "id": "requirements", "title": "Requirements", "content": "...", "requirements": [{ "title": "...", "description": "...", "type": "functional|non_functional|security", "priority": "must|should|could", "acceptance_criteria": [{ "description": "...", "testable": true }] }] },
    { "id": "out_of_scope", "title": "Out of Scope", "content": "..." },
    { "id": "success_metrics", "title": "Success Metrics", "content": "..." }
  ]
}
Respond with valid JSON only.`;

    case 'architecture':
      return base + `Generate an architecture document as JSON with sections: overview, components, data_model, api_design, security, scalability, decisions. Each section has id, title, content. Respond with valid JSON only.`;

    case 'test_plan':
      return base + `Generate a test plan as JSON with sections: strategy, scope, test_cases (array), security_tests, performance_tests, exit_criteria. Each section has id, title, content. Respond with valid JSON only.`;

    default:
      return base + `Generate a ${type} document as JSON with a "sections" array. Respond with valid JSON only.`;
  }
}
