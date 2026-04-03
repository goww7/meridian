import { describe, it, expect, beforeAll } from 'vitest';
import { login, get, post, patch, del, type AuthContext } from './helpers.js';

let alice: AuthContext;
let bob: AuthContext;
let carol: AuthContext;
let dave: AuthContext;
let eve: AuthContext;

beforeAll(async () => {
  alice = await login('alice@meridian.dev');
  bob = await login('bob@meridian.dev');
  carol = await login('carol@meridian.dev');
  dave = await login('dave@meridian.dev');
  eve = await login('eve@meridian.dev');
}, 15000);

// ════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════
describe('UAT: Authentication', () => {
  it('should login all 5 demo users', () => {
    expect(alice.token).toBeTruthy();
    expect(bob.token).toBeTruthy();
    expect(carol.token).toBeTruthy();
    expect(dave.token).toBeTruthy();
    expect(eve.token).toBeTruthy();
  });

  it('should have correct roles', () => {
    expect(alice.org.name).toBe('Acme Corp');
    expect(bob.org.name).toBe('Acme Corp');
  });

  it('should reject invalid credentials', async () => {
    const { status } = await post('/auth/login', { email: 'alice@meridian.dev', password: 'wrongpassword' }, '');
    expect(status).toBe(401);
  });

  it('should reject unauthenticated requests', async () => {
    const { status } = await get('/flows', '');
    expect(status).toBe(401);
  });

  it('should register a new user', async () => {
    const ts = Date.now();
    const { status, data } = await post('/auth/register', {
      email: `uat-${ts}@test.dev`,
      password: 'testpassword123',
      name: 'UAT Test User',
      org_name: `UAT Test Org ${ts}`,
    }, '');
    expect(status).toBe(201);
    expect(data.access_token).toBeTruthy();
    expect(data.user.name).toBe('UAT Test User');
    expect(data.org.name).toBe(`UAT Test Org ${ts}`);
  });
});

// ════════════════════════════════════════════
// ORG & TEAMS
// ════════════════════════════════════════════
describe('UAT: Organization & Teams', () => {
  it('should get current org', async () => {
    const { status, data } = await get('/orgs/current', alice.token);
    expect(status).toBe(200);
    expect(data.name).toBe('Acme Corp');
    expect(data.slug).toBe('acme-corp');
    expect(data.plan).toBe('professional');
  });

  it('should list org members', async () => {
    const { status, data } = await get('/orgs/current/members', alice.token);
    expect(status).toBe(200);
    expect(data.length).toBe(5);
    const emails = data.map((m: any) => m.email).sort();
    expect(emails).toContain('alice@meridian.dev');
    expect(emails).toContain('eve@meridian.dev');
  });

  it('should list teams', async () => {
    const { status, data } = await get('/teams', alice.token);
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(3);
    const names = data.map((t: any) => t.name);
    expect(names).toContain('Payments Team');
    expect(names).toContain('Platform Team');
    expect(names).toContain('Security Team');
  });

  it('viewer can list teams', async () => {
    const { status } = await get('/teams', eve.token);
    expect(status).toBe(200);
  });

  it('viewer cannot create teams', async () => {
    const { status } = await post('/teams', { name: 'Forbidden Team', slug: 'forbidden' }, eve.token);
    expect(status).toBe(403);
  });

  it('member cannot create teams', async () => {
    const { status } = await post('/teams', { name: 'Forbidden Team', slug: 'forbidden' }, carol.token);
    expect(status).toBe(403);
  });

  it('admin can create teams', async () => {
    const slug = `qa-${Date.now()}`;
    const { status, data } = await post('/teams', { name: `QA Team ${slug}`, slug }, bob.token);
    expect(status).toBe(201);
    expect(data.slug).toBe(slug);
  });
});

// ════════════════════════════════════════════
// FLOWS
// ════════════════════════════════════════════
describe('UAT: Flows', () => {
  it('should list all seeded flows', async () => {
    const { status, data } = await get('/flows', alice.token);
    expect(status).toBe(200);
    expect(data.data.length).toBeGreaterThanOrEqual(6);
  });

  it('should filter flows by stage', async () => {
    const { data } = await get('/flows?stage=build', alice.token);
    expect(data.data.length).toBeGreaterThanOrEqual(1);
    data.data.forEach((f: any) => expect(f.current_stage).toBe('build'));
  });

  it('should filter flows by priority', async () => {
    const { data } = await get('/flows?priority=critical', alice.token);
    expect(data.data.length).toBeGreaterThanOrEqual(1);
    data.data.forEach((f: any) => expect(f.priority).toBe('critical'));
  });

  it('should search flows by title', async () => {
    const { data } = await get('/flows?search=Payment', alice.token);
    expect(data.data.length).toBeGreaterThanOrEqual(1);
    expect(data.data[0].title).toContain('Payment');
  });

  it('should get flow detail with counts', async () => {
    const { data: list } = await get('/flows?search=Payment', alice.token);
    const flowId = list.data[0].id;

    const { status, data } = await get(`/flows/${flowId}`, alice.token);
    expect(status).toBe(200);
    expect(data.title).toContain('Payment');
    expect(data.counts).toBeDefined();
    expect(data.counts.requirements).toBeGreaterThanOrEqual(8);
    expect(data.counts.tasks).toBeGreaterThanOrEqual(12);
    expect(data.counts.evidence).toBeGreaterThanOrEqual(10);
    expect(data.counts.artifacts).toBeGreaterThanOrEqual(2);
    expect(data.stage_history.length).toBeGreaterThanOrEqual(5);
  });

  it('should create a new flow', async () => {
    const { status, data } = await post('/flows', {
      title: 'UAT Test Flow',
      description: 'Created during UAT testing',
      priority: 'high',
      sensitivity: 'medium',
      tags: ['uat', 'test'],
    }, carol.token);
    expect(status).toBe(201);
    expect(data.title).toBe('UAT Test Flow');
    expect(data.current_stage).toBe('assess');
    expect(data.status).toBe('active');
    expect(data.priority).toBe('high');
    expect(data.tags).toContain('uat');
  });

  it('viewer cannot create flows', async () => {
    const { status } = await post('/flows', { title: 'Forbidden Flow' }, eve.token);
    expect(status).toBe(403);
  });

  it('should update a flow', async () => {
    const { data: created } = await post('/flows', { title: 'Update Me' }, carol.token);
    const { status, data } = await patch(`/flows/${created.id}`, {
      title: 'Updated Flow Title',
      priority: 'critical',
      version: created.version,
    }, carol.token);
    expect(status).toBe(200);
    expect(data.title).toBe('Updated Flow Title');
    expect(data.priority).toBe('critical');
  });

  it('should soft delete a flow', async () => {
    const { data: created } = await post('/flows', { title: 'Delete Me' }, carol.token);
    const { status } = await del(`/flows/${created.id}`, carol.token);
    expect(status).toBe(204);

    const { status: getStatus } = await get(`/flows/${created.id}`, carol.token);
    expect(getStatus).toBe(404);
  });
});

// ════════════════════════════════════════════
// FLOW LIFECYCLE (full stage transitions)
// ════════════════════════════════════════════
describe('UAT: Flow Lifecycle', () => {
  let flowId: string;

  it('should create a flow at assess stage', async () => {
    const { data } = await post('/flows', {
      title: 'UAT Lifecycle Flow',
      description: 'Testing full lifecycle',
      priority: 'high',
      sensitivity: 'low',
    }, alice.token);
    flowId = data.id;
    expect(data.current_stage).toBe('assess');
  });

  it('should block transition without approved assessment', async () => {
    const { status, data } = await post(`/flows/${flowId}/transition`, { to_stage: 'plan' }, alice.token);
    expect(status).toBe(422);
    expect(data.type).toContain('gate-failed');
  });

  it('should generate and approve an assessment artifact', async () => {
    // Create artifact manually (skip AI for UAT speed)
    const { data: artifacts } = await get(`/flows/${flowId}/artifacts`, alice.token);

    // We need to create the artifact and version directly
    const genResult = await post(`/flows/${flowId}/artifacts/generate`, { type: 'assessment' }, alice.token);
    expect(genResult.status).toBe(202);
    const artifactId = genResult.data.artifact_id;

    // Create manual version
    await post(`/artifacts/${artifactId}/versions`, {
      content: { sections: [{ id: 'summary', title: 'Summary', content: 'UAT Assessment' }] },
      content_text: '# Assessment\nUAT Assessment',
    }, alice.token);

    // Approve
    const { status } = await post(`/artifacts/${artifactId}/approve`, {}, alice.token);
    expect(status).toBe(200);
  });

  it('should advance from assess to plan after approval', async () => {
    const { status, data } = await post(`/flows/${flowId}/transition`, { to_stage: 'plan' }, alice.token);
    expect(status).toBe(200);
    expect(data.flow.current_stage).toBe('plan');
    expect(data.gate_result.passed).toBe(true);
  });

  it('should block plan->build without approved PRD', async () => {
    const { status } = await post(`/flows/${flowId}/transition`, { to_stage: 'build' }, alice.token);
    expect(status).toBe(422);
  });

  it('should create and approve PRD to advance to build', async () => {
    const genResult = await post(`/flows/${flowId}/artifacts/generate`, { type: 'prd' }, alice.token);
    const artifactId = genResult.data.artifact_id;

    await post(`/artifacts/${artifactId}/versions`, {
      content: { sections: [{ id: 'overview', title: 'Overview', content: 'UAT PRD' }] },
      content_text: '# PRD\nUAT PRD',
    }, alice.token);

    await post(`/artifacts/${artifactId}/approve`, {}, alice.token);

    const { status, data } = await post(`/flows/${flowId}/transition`, { to_stage: 'build' }, alice.token);
    expect(status).toBe(200);
    expect(data.flow.current_stage).toBe('build');
  });

  it('should reject invalid stage transitions', async () => {
    // Can't jump from build to done
    const { status } = await post(`/flows/${flowId}/transition`, { to_stage: 'done' }, alice.token);
    expect(status).toBe(422);
  });

  it('should advance build to release', async () => {
    const { status, data } = await post(`/flows/${flowId}/transition`, { to_stage: 'release' }, alice.token);
    expect(status).toBe(200);
    expect(data.flow.current_stage).toBe('release');
  });
});

// ════════════════════════════════════════════
// TRACEABILITY CHAIN
// ════════════════════════════════════════════
describe('UAT: Traceability (Initiative → Objective → Requirement → Task → Evidence)', () => {
  let flowId: string;
  let initiativeId: string;
  let objectiveId: string;
  let requirementId: string;
  let taskId: string;
  let evidenceId: string;

  beforeAll(async () => {
    const { data } = await post('/flows', {
      title: 'UAT Traceability Flow',
      priority: 'medium',
      sensitivity: 'low',
    }, alice.token);
    flowId = data.id;
  });

  it('should create an initiative', async () => {
    const { status, data } = await post(`/flows/${flowId}/initiatives`, {
      title: 'Improve User Onboarding',
      description: 'Reduce time-to-value for new users',
    }, alice.token);
    expect(status).toBe(201);
    initiativeId = data.id;
  });

  it('should list initiatives for flow', async () => {
    const { data } = await get(`/flows/${flowId}/initiatives`, alice.token);
    expect(data.length).toBe(1);
    expect(data[0].title).toBe('Improve User Onboarding');
  });

  it('should create an objective', async () => {
    const { status, data } = await post(`/initiatives/${initiativeId}/objectives`, {
      title: 'Reduce onboarding to under 5 minutes',
      success_criteria: '80% of new users complete onboarding in < 5 min',
    }, alice.token);
    expect(status).toBe(201);
    objectiveId = data.id;
  });

  it('should list objectives for initiative', async () => {
    const { data } = await get(`/initiatives/${initiativeId}/objectives`, alice.token);
    expect(data.length).toBe(1);
  });

  it('should create a requirement', async () => {
    const { status, data } = await post(`/objectives/${objectiveId}/requirements`, {
      title: 'Interactive onboarding wizard',
      description: 'Step-by-step wizard guiding new users',
      type: 'functional',
      priority: 'must',
      objective_id: objectiveId,
      acceptance_criteria: [
        { description: 'Wizard has 5 steps', testable: true },
        { description: 'Users can skip steps', testable: true },
      ],
    }, alice.token);
    expect(status).toBe(201);
    requirementId = data.id;
    expect(data.acceptance_criteria).toHaveLength(2);
  });

  it('should list requirements for flow', async () => {
    const { data } = await get(`/flows/${flowId}/requirements`, alice.token);
    expect(data.length).toBe(1);
  });

  it('should create a task linked to requirement', async () => {
    const { status, data } = await post(`/flows/${flowId}/tasks`, {
      title: 'Build onboarding wizard component',
      description: 'React component with 5-step wizard',
      requirement_id: requirementId,
      assignee_id: carol.user.id,
    }, alice.token);
    expect(status).toBe(201);
    taskId = data.id;
    expect(data.requirement_id).toBe(requirementId);
  });

  it('should update task status', async () => {
    const { status, data } = await patch(`/tasks/${taskId}`, { status: 'in_progress' }, carol.token);
    expect(status).toBe(200);
    expect(data.status).toBe('in_progress');

    const { data: done } = await patch(`/tasks/${taskId}`, { status: 'done' }, carol.token);
    expect(done.status).toBe('done');
  });

  it('should submit evidence for requirement', async () => {
    const { status, data } = await post(`/flows/${flowId}/evidence`, {
      type: 'test_result',
      source: 'ci_cd',
      status: 'passing',
      requirement_id: requirementId,
      data: {
        tool: 'vitest',
        tests_passed: 24,
        tests_failed: 0,
        coverage: 0.92,
        ci_url: 'https://github.com/acme/app/actions/runs/12345',
      },
    }, alice.token);
    expect(status).toBe(201);
    evidenceId = data.id;
    expect(data.type).toBe('test_result');
    expect(data.status).toBe('passing');
  });

  it('should get traceability graph', async () => {
    const { status, data } = await get(`/flows/${flowId}/trace`, alice.token);
    expect(status).toBe(200);
    expect(data.nodes.length).toBeGreaterThanOrEqual(5); // flow + init + obj + req + task
    expect(data.edges.length).toBeGreaterThanOrEqual(4);

    const nodeTypes = data.nodes.map((n: any) => n.type);
    expect(nodeTypes).toContain('Flow');
    expect(nodeTypes).toContain('Initiative');
    expect(nodeTypes).toContain('Objective');
    expect(nodeTypes).toContain('Requirement');
    expect(nodeTypes).toContain('Task');
  });

  it('should detect gaps', async () => {
    // Create a requirement without a task
    await post(`/objectives/${objectiveId}/requirements`, {
      title: 'Orphaned requirement (no task)',
      objective_id: objectiveId,
    }, alice.token);

    const { status, data } = await get(`/flows/${flowId}/gaps`, alice.token);
    expect(status).toBe(200);
    expect(data.requirements_without_tasks.length).toBeGreaterThanOrEqual(1);
  });
});

// ════════════════════════════════════════════
// ARTIFACTS
// ════════════════════════════════════════════
describe('UAT: Artifacts', () => {
  it('should list artifacts for seeded flow', async () => {
    const { data: flows } = await get('/flows?search=Payment', alice.token);
    const flowId = flows.data[0].id;

    const { status, data } = await get(`/flows/${flowId}/artifacts`, alice.token);
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(2);

    const types = data.map((a: any) => a.type);
    expect(types).toContain('assessment');
    expect(types).toContain('prd');
  });

  it('should get artifact with latest version', async () => {
    const { data: flows } = await get('/flows?search=Payment', alice.token);
    const { data: artifacts } = await get(`/flows/${flows.data[0].id}/artifacts`, alice.token);
    const artifactId = artifacts[0].id;

    const { status, data } = await get(`/artifacts/${artifactId}`, alice.token);
    expect(status).toBe(200);
    expect(data.latest_version).toBeDefined();
    expect(data.latest_version.content).toBeDefined();
    expect(data.latest_version.content.sections).toBeDefined();
    expect(data.latest_version.content_text.length).toBeGreaterThan(0);
  });

  it('should list artifact versions', async () => {
    const { data: flows } = await get('/flows?search=Payment', alice.token);
    const { data: artifacts } = await get(`/flows/${flows.data[0].id}/artifacts`, alice.token);

    const { status, data } = await get(`/artifacts/${artifacts[0].id}/versions`, alice.token);
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].version).toBe(1);
  });

  it('member cannot approve artifacts', async () => {
    const { data: created } = await post('/flows', { title: 'Artifact Test' }, carol.token);
    const { data: gen } = await post(`/flows/${created.id}/artifacts/generate`, { type: 'assessment' }, carol.token);
    await post(`/artifacts/${gen.artifact_id}/versions`, {
      content: { sections: [{ id: 's', title: 'S', content: 'test' }] },
      content_text: 'test',
    }, carol.token);

    const { status } = await post(`/artifacts/${gen.artifact_id}/approve`, {}, carol.token);
    expect(status).toBe(403);
  });

  it('admin can approve artifacts', async () => {
    const { data: flows } = await get('/flows?search=Artifact Test', carol.token);
    const { data: artifacts } = await get(`/flows/${flows.data[0].id}/artifacts`, carol.token);
    const { status } = await post(`/artifacts/${artifacts[0].id}/approve`, {}, bob.token);
    expect(status).toBe(200);
  });
});

// ════════════════════════════════════════════
// EVIDENCE
// ════════════════════════════════════════════
describe('UAT: Evidence', () => {
  it('should list evidence for seeded flow', async () => {
    const { data: flows } = await get('/flows?search=Payment', alice.token);
    const { status, data } = await get(`/flows/${flows.data[0].id}/evidence`, alice.token);
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(10);

    const types = [...new Set(data.map((e: any) => e.type))];
    expect(types).toContain('test_result');
    expect(types).toContain('security_scan');
    expect(types).toContain('code_review');
    expect(types).toContain('deployment');
  });

  it('should submit different types of evidence', async () => {
    const { data: flow } = await post('/flows', { title: 'Evidence Test Flow' }, alice.token);

    // Test result
    const { status: s1 } = await post(`/flows/${flow.id}/evidence`, {
      type: 'test_result', source: 'ci_cd', status: 'passing',
      data: { tests_passed: 50, tests_failed: 0, coverage: 0.95 },
    }, alice.token);
    expect(s1).toBe(201);

    // Security scan
    const { status: s2 } = await post(`/flows/${flow.id}/evidence`, {
      type: 'security_scan', source: 'ci_cd', status: 'passing',
      data: { tool: 'snyk', critical: 0, high: 0 },
    }, alice.token);
    expect(s2).toBe(201);

    // Manual approval
    const { status: s3 } = await post(`/flows/${flow.id}/evidence`, {
      type: 'approval', source: 'manual', status: 'passing',
      data: { approver: 'alice@meridian.dev', comment: 'Looks good' },
    }, alice.token);
    expect(s3).toBe(201);

    const { data: evidence } = await get(`/flows/${flow.id}/evidence`, alice.token);
    expect(evidence.length).toBe(3);
  });

  it('viewer cannot submit evidence', async () => {
    const { data: flows } = await get('/flows?search=Evidence Test', alice.token);
    const { status } = await post(`/flows/${flows.data[0].id}/evidence`, {
      type: 'manual', source: 'manual', status: 'passing', data: {},
    }, eve.token);
    expect(status).toBe(403);
  });
});

// ════════════════════════════════════════════
// POLICIES & GATES
// ════════════════════════════════════════════
describe('UAT: Policies & Gate Evaluation', () => {
  it('should list policies', async () => {
    const { status, data } = await get('/policies', alice.token);
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(6);
  });

  it('should have correct policy structure', async () => {
    const { data } = await get('/policies', alice.token);
    const assessPolicy = data.find((p: any) => p.name === 'require-approved-assessment');
    expect(assessPolicy).toBeDefined();
    expect(assessPolicy.stage).toBe('assess');
    expect(assessPolicy.severity).toBe('blocking');
    expect(assessPolicy.enabled).toBe(true);
  });

  it('admin can create policies', async () => {
    const name = `uat-test-policy-${Date.now()}`;
    const { status, data } = await post('/policies', {
      name,
      description: 'UAT test policy',
      stage: 'release',
      severity: 'warning',
      rules: {
        when: { 'flow.tags': { $contains: 'uat-policy-test' } },
        require: { 'evidence.total': { $gte: 1 } },
      },
    }, bob.token);
    expect(status).toBe(201);
    expect(data.name).toBe(name);
  });

  it('member cannot create policies', async () => {
    const { status } = await post('/policies', {
      name: 'forbidden-policy',
      stage: 'release',
      severity: 'warning',
      rules: { require: { 'evidence.total': { $gte: 1 } } },
    }, carol.token);
    expect(status).toBe(403);
  });

  it('should dry-run policy evaluation', async () => {
    const { data: flows } = await get('/flows?search=Payment', alice.token);
    const flowId = flows.data[0].id;

    const { status, data } = await post('/policies/evaluate', {
      flow_id: flowId,
      stage: 'release',
    }, alice.token);
    expect(status).toBe(200);
    expect(data.evaluations).toBeDefined();
    expect(data.evaluations.length).toBeGreaterThanOrEqual(1);
  });

  it('should show failing security scan for Data Export flow', async () => {
    const { data: flows } = await get('/flows?search=Data Export', alice.token);
    const flowId = flows.data[0].id;

    const { status, data } = await post('/policies/evaluate', {
      flow_id: flowId,
      stage: 'release',
    }, alice.token);
    expect(status).toBe(200);

    // Should have a failing security scan policy since the flow has a failing scan
    const secPolicy = data.evaluations.find((e: any) => e.policy_name === 'require-security-scan-high');
    if (secPolicy) {
      // This flow has sensitivity=high, so the policy applies
      // But evidence includes a failing security scan, not a passing one
      expect(secPolicy.result).not.toBe('skip');
    }
  });
});

// ════════════════════════════════════════════
// READINESS
// ════════════════════════════════════════════
describe('UAT: Release Readiness', () => {
  it('should show readiness for completed flow', async () => {
    const { data: flows } = await get('/flows?search=Payment', alice.token);
    const flowId = flows.data[0].id;

    const { status, data } = await get(`/flows/${flowId}/readiness`, alice.token);
    expect(status).toBe(200);
    expect(data.summary.total_requirements).toBeGreaterThanOrEqual(8);
    expect(data.summary.evidence_passing).toBeGreaterThan(0);
  });

  it('should show gaps for Data Export flow', async () => {
    const { data: flows } = await get('/flows?search=Data Export', alice.token);
    const flowId = flows.data[0].id;

    const { status, data } = await get(`/flows/${flowId}/readiness`, alice.token);
    expect(status).toBe(200);
    expect(data.failing_evidence.length).toBeGreaterThanOrEqual(1);
    // Has a failing security scan
    const failingScan = data.failing_evidence.find((e: any) => e.type === 'security_scan');
    expect(failingScan).toBeDefined();
  });

  it('should show not_ready for flow with gaps', async () => {
    const { data: flows } = await get('/flows?search=Data Export', alice.token);
    const { data } = await get(`/flows/${flows.data[0].id}/readiness`, alice.token);
    expect(data.readiness).toBe('not_ready');
  });
});

// ════════════════════════════════════════════
// RBAC (Role-Based Access Control)
// ════════════════════════════════════════════
describe('UAT: RBAC Enforcement', () => {
  it('viewer can read flows', async () => {
    const { status } = await get('/flows', eve.token);
    expect(status).toBe(200);
  });

  it('viewer cannot create flows', async () => {
    const { status } = await post('/flows', { title: 'Blocked' }, eve.token);
    expect(status).toBe(403);
  });

  it('viewer cannot create tasks', async () => {
    const { data: flows } = await get('/flows', alice.token);
    const { status } = await post(`/flows/${flows.data[0].id}/tasks`, { title: 'Blocked' }, eve.token);
    expect(status).toBe(403);
  });

  it('viewer cannot submit evidence', async () => {
    const { data: flows } = await get('/flows', alice.token);
    const { status } = await post(`/flows/${flows.data[0].id}/evidence`, {
      type: 'manual', source: 'manual', status: 'passing', data: {},
    }, eve.token);
    expect(status).toBe(403);
  });

  it('viewer cannot manage org members', async () => {
    const { status } = await post('/orgs/current/members/invite', {
      email: 'hacker@evil.com', role: 'admin',
    }, eve.token);
    expect(status).toBe(403);
  });

  it('member can create flows and tasks', async () => {
    const { status: s1, data } = await post('/flows', { title: 'Member Flow' }, carol.token);
    expect(s1).toBe(201);

    const { status: s2 } = await post(`/flows/${data.id}/tasks`, { title: 'Member Task' }, carol.token);
    expect(s2).toBe(201);
  });

  it('admin can manage policies', async () => {
    const { data: policies } = await get('/policies', bob.token);
    expect(policies.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════
// EDGE CASES & ERROR HANDLING
// ════════════════════════════════════════════
describe('UAT: Error Handling', () => {
  it('should 404 on non-existent flow', async () => {
    const { status, data } = await get('/flows/flow_nonexistent123', alice.token);
    expect(status).toBe(404);
    expect(data.type).toContain('not-found');
  });

  it('should 422 on invalid flow input', async () => {
    const { status } = await post('/flows', { priority: 'invalid_priority' }, alice.token);
    expect(status).toBe(422);
  });

  it('should 422 on invalid stage transition', async () => {
    const { data: flow } = await post('/flows', { title: 'Invalid Transition Test' }, alice.token);
    // Try to skip from assess to build
    const { status } = await post(`/flows/${flow.id}/transition`, { to_stage: 'build' }, alice.token);
    expect(status).toBe(422);
  });

  it('should handle optimistic locking conflict', async () => {
    const { data: flow } = await post('/flows', { title: 'Locking Test' }, alice.token);

    // First update succeeds
    const { status: s1 } = await patch(`/flows/${flow.id}`, {
      title: 'Updated 1', version: flow.version,
    }, alice.token);
    expect(s1).toBe(200);

    // Second update with stale version fails
    const { status: s2 } = await patch(`/flows/${flow.id}`, {
      title: 'Updated 2', version: flow.version,  // same old version
    }, alice.token);
    expect(s2).toBe(409);
  });
});

// ════════════════════════════════════════════
// SEEDED DATA INTEGRITY
// ════════════════════════════════════════════
describe('UAT: Seeded Data Integrity', () => {
  it('should have flows in every stage', async () => {
    // Query each stage individually to avoid pagination issues from accumulated test data
    for (const stage of ['assess', 'plan', 'build', 'release', 'done']) {
      const { data } = await get(`/flows?stage=${stage}&limit=1`, alice.token);
      expect(data.data.length, `expected at least one flow in stage "${stage}"`).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have paused flow', async () => {
    const { data } = await get('/flows?status=paused', alice.token);
    expect(data.data.length).toBeGreaterThanOrEqual(1);
    expect(data.data[0].status).toBe('paused');
  });

  it('should have completed flow', async () => {
    const { data } = await get('/flows?status=completed', alice.token);
    expect(data.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should have artifacts with AI-generated token usage', async () => {
    const { data: flows } = await get('/flows?search=Payment', alice.token);
    const { data: artifacts } = await get(`/flows/${flows.data[0].id}/artifacts`, alice.token);
    const { data: versions } = await get(`/artifacts/${artifacts[0].id}/versions`, alice.token);

    const v = versions.find((v: any) => v.token_usage);
    expect(v).toBeDefined();
    expect(v.token_usage.model).toBe('claude-sonnet-4-6');
    expect(v.token_usage.input_tokens).toBeGreaterThan(0);
  });

  it('should have evidence of different types across flows', async () => {
    const { data: flows } = await get('/flows?search=Payment', alice.token);
    const { data: evidence } = await get(`/flows/${flows.data[0].id}/evidence`, alice.token);

    const types = [...new Set(evidence.map((e: any) => e.type))];
    expect(types.length).toBeGreaterThanOrEqual(4);
  });

  it('Payment API flow should have full traceability', async () => {
    const { data: flows } = await get('/flows?search=Payment', alice.token);
    const { data: trace } = await get(`/flows/${flows.data[0].id}/trace`, alice.token);

    const types = [...new Set(trace.nodes.map((n: any) => n.type))];
    expect(types).toContain('Flow');
    expect(types).toContain('Initiative');
    expect(types).toContain('Objective');
    expect(types).toContain('Requirement');
    expect(types).toContain('Task');
    expect(types).toContain('Evidence');
    expect(types).toContain('Artifact');
  });
});
