import pg from 'pg';
import { ulid } from 'ulid';
import * as argon2 from 'argon2';

const id = (prefix: string) => `${prefix}_${ulid().toLowerCase()}`;

async function uatSeed() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://meridian:meridian@localhost:5432/meridian',
  });
  await client.connect();
  console.log('🔧 Starting UAT seed...\n');

  // Clean existing data
  await client.query(`
    TRUNCATE events, policy_evaluations, policies, evidence, artifact_versions, artifacts,
    tasks, requirements, objectives, initiatives, flow_stage_transitions, flows,
    team_members, teams, org_members, orgs, users CASCADE
  `);
  console.log('  ✓ Cleaned existing data');

  const passwordHash = await argon2.hash('demo1234');

  // ──────────────────────────────────────────────
  // USERS
  // ──────────────────────────────────────────────
  const users = {
    alice: id('usr'),
    bob: id('usr'),
    carol: id('usr'),
    dave: id('usr'),
    eve: id('usr'),
  };

  const userRows = [
    [users.alice, 'alice@meridian.dev', 'Alice Chen', passwordHash],
    [users.bob, 'bob@meridian.dev', 'Bob Martinez', passwordHash],
    [users.carol, 'carol@meridian.dev', 'Carol Williams', passwordHash],
    [users.dave, 'dave@meridian.dev', 'Dave Kim', passwordHash],
    [users.eve, 'eve@meridian.dev', 'Eve Johnson', passwordHash],
  ];

  for (const [uid, email, name, hash] of userRows) {
    await client.query('INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)', [uid, email, name, hash]);
  }
  console.log('  ✓ Created 5 users (password: demo1234)');

  // ──────────────────────────────────────────────
  // ORG
  // ──────────────────────────────────────────────
  const orgId = id('org');
  await client.query('INSERT INTO orgs (id, name, slug, plan) VALUES ($1, $2, $3, $4)', [orgId, 'Acme Corp', 'acme-corp', 'professional']);

  const roles: [string, string][] = [
    [users.alice, 'owner'],
    [users.bob, 'admin'],
    [users.carol, 'member'],
    [users.dave, 'member'],
    [users.eve, 'viewer'],
  ];
  for (const [uid, role] of roles) {
    await client.query('INSERT INTO org_members (id, org_id, user_id, role) VALUES ($1, $2, $3, $4)', [id('mem'), orgId, uid, role]);
  }
  console.log('  ✓ Created org "Acme Corp" with 5 members');

  // ──────────────────────────────────────────────
  // TEAMS
  // ──────────────────────────────────────────────
  const teams = {
    platform: id('team'),
    payments: id('team'),
    security: id('team'),
  };

  await client.query('INSERT INTO teams (id, org_id, name, slug) VALUES ($1, $2, $3, $4)', [teams.platform, orgId, 'Platform Team', 'platform']);
  await client.query('INSERT INTO teams (id, org_id, name, slug) VALUES ($1, $2, $3, $4)', [teams.payments, orgId, 'Payments Team', 'payments']);
  await client.query('INSERT INTO teams (id, org_id, name, slug) VALUES ($1, $2, $3, $4)', [teams.security, orgId, 'Security Team', 'security']);

  await client.query('INSERT INTO team_members (id, team_id, user_id, role) VALUES ($1, $2, $3, $4)', [id('tmem'), teams.platform, users.alice, 'lead']);
  await client.query('INSERT INTO team_members (id, team_id, user_id, role) VALUES ($1, $2, $3, $4)', [id('tmem'), teams.platform, users.bob, 'member']);
  await client.query('INSERT INTO team_members (id, team_id, user_id, role) VALUES ($1, $2, $3, $4)', [id('tmem'), teams.payments, users.carol, 'lead']);
  await client.query('INSERT INTO team_members (id, team_id, user_id, role) VALUES ($1, $2, $3, $4)', [id('tmem'), teams.payments, users.dave, 'member']);
  await client.query('INSERT INTO team_members (id, team_id, user_id, role) VALUES ($1, $2, $3, $4)', [id('tmem'), teams.security, users.bob, 'lead']);
  console.log('  ✓ Created 3 teams');

  // ──────────────────────────────────────────────
  // POLICIES (default gates)
  // ──────────────────────────────────────────────
  const policies = {
    assessGate: id('pol'),
    planGate: id('pol'),
    testCoverage: id('pol'),
    tasksComplete: id('pol'),
    securityScan: id('pol'),
    approvalCritical: id('pol'),
  };

  const policyRows = [
    [policies.assessGate, 'require-approved-assessment', 'Assessment must be approved before moving to Plan', 'assess', 'blocking', { require: { 'artifacts.approved': { $contains: 'assessment' } } }],
    [policies.planGate, 'require-approved-prd', 'PRD must be approved before moving to Build', 'plan', 'blocking', { require: { 'artifacts.approved': { $contains: 'prd' } } }],
    [policies.testCoverage, 'require-test-coverage', 'Minimum 80% test coverage before release', 'release', 'blocking', { require: { 'evidence.coverage': { $gte: 0.8 } } }],
    [policies.tasksComplete, 'require-tasks-complete', 'All tasks must be done before release', 'release', 'blocking', { require: { 'tasks.completion_ratio': { $eq: 1.0 } } }],
    [policies.securityScan, 'require-security-scan-high', 'HIGH sensitivity flows need security scan', 'release', 'blocking', { when: { 'flow.sensitivity': { $in: ['high'] } }, require: { 'evidence.types_present': { $contains: 'security_scan' } } }],
    [policies.approvalCritical, 'require-approval-critical', 'Critical flows need explicit approval', 'release', 'warning', { when: { 'flow.priority': { $eq: 'critical' } }, require: { 'approvals.approved': { $gte: 1 } } }],
  ];

  for (const [pid, name, desc, stage, severity, rules] of policyRows) {
    await client.query(
      'INSERT INTO policies (id, org_id, name, description, stage, severity, rules) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [pid, orgId, name, desc, stage, severity, JSON.stringify(rules)],
    );
  }
  console.log('  ✓ Created 6 policies');

  // ──────────────────────────────────────────────
  // FLOW 1: Payment API v2 (DONE — full lifecycle)
  // ──────────────────────────────────────────────
  const flow1 = id('flow');
  await client.query(
    `INSERT INTO flows (id, org_id, title, description, current_stage, status, priority, sensitivity, owner_id, team_id, tags)
     VALUES ($1, $2, $3, $4, 'done', 'completed', 'critical', 'high', $5, $6, $7)`,
    [flow1, orgId, 'Payment API v2', 'Rebuild payment processing API for PCI-DSS compliance. Migrate from legacy Stripe integration to new multi-provider architecture.', users.alice, teams.payments, ['payments', 'pci', 'api']],
  );

  // Stage history
  const f1Stages = [
    [null, 'assess', users.alice],
    ['assess', 'plan', users.alice],
    ['plan', 'build', users.alice],
    ['build', 'release', users.bob],
    ['release', 'done', users.alice],
  ];
  for (const [from, to, by] of f1Stages) {
    await client.query(
      'INSERT INTO flow_stage_transitions (id, flow_id, org_id, from_stage, to_stage, triggered_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [id('fst'), flow1, orgId, from, to, by],
    );
  }

  // Initiative
  const init1 = id('init');
  await client.query('INSERT INTO initiatives (id, org_id, flow_id, title, description, status) VALUES ($1, $2, $3, $4, $5, $6)',
    [init1, orgId, flow1, 'Modernize Payment Infrastructure', 'Replace legacy payment gateway with a multi-provider, PCI-compliant architecture', 'completed']);

  // Objectives
  const obj1a = id('obj');
  const obj1b = id('obj');
  const obj1c = id('obj');
  await client.query('INSERT INTO objectives (id, org_id, initiative_id, title, description, success_criteria, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [obj1a, orgId, init1, 'Achieve PCI-DSS Level 1 Compliance', 'Ensure all payment data handling meets PCI-DSS requirements', 'Pass external QSA audit with zero critical findings', 'completed']);
  await client.query('INSERT INTO objectives (id, org_id, initiative_id, title, description, success_criteria, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [obj1b, orgId, init1, 'Reduce Payment Latency', 'Process payments faster with async architecture', 'p99 latency < 500ms over 7 days', 'completed']);
  await client.query('INSERT INTO objectives (id, org_id, initiative_id, title, description, success_criteria, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [obj1c, orgId, init1, 'Multi-Provider Support', 'Support Stripe, Adyen, and PayPal as payment providers', 'All 3 providers integrated and tested', 'completed']);

  // Requirements
  const reqs1 = [
    [id('req'), obj1a, 'Encrypt all PII at rest using AES-256', 'security', 'must', 'implemented', [{ description: 'All PII columns encrypted', testable: true }, { description: 'Key rotation every 90 days', testable: true }]],
    [id('req'), obj1a, 'Tokenize card numbers before storage', 'security', 'must', 'verified', [{ description: 'No raw card numbers in database', testable: true }]],
    [id('req'), obj1a, 'Audit log all payment operations', 'compliance', 'must', 'verified', [{ description: 'Every payment action logged with actor, timestamp, and details', testable: true }]],
    [id('req'), obj1b, 'Implement async payment processing queue', 'functional', 'must', 'verified', [{ description: 'Payments processed via BullMQ', testable: true }, { description: 'Failed payments retry up to 3 times', testable: true }]],
    [id('req'), obj1b, 'Payment webhook delivery < 5s', 'non_functional', 'should', 'implemented', [{ description: 'Webhook sent within 5s of status change', testable: true }]],
    [id('req'), obj1c, 'Stripe provider adapter', 'functional', 'must', 'verified', [{ description: 'Create charge, refund, capture via Stripe', testable: true }]],
    [id('req'), obj1c, 'Adyen provider adapter', 'functional', 'must', 'verified', [{ description: 'Create charge, refund, capture via Adyen', testable: true }]],
    [id('req'), obj1c, 'PayPal provider adapter', 'functional', 'could', 'implemented', [{ description: 'Create charge, refund via PayPal', testable: true }]],
  ];

  for (const [rid, objId, title, type, priority, status, ac] of reqs1) {
    await client.query(
      'INSERT INTO requirements (id, org_id, flow_id, objective_id, title, type, priority, status, acceptance_criteria) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [rid, orgId, flow1, objId, title, type, priority, status, JSON.stringify(ac)],
    );
  }

  // Tasks (all done)
  const tasks1 = [
    [id('task'), reqs1[0][0], 'Implement AES-256 column encryption', users.carol, 'done'],
    [id('task'), reqs1[1][0], 'Build card tokenization service', users.carol, 'done'],
    [id('task'), reqs1[2][0], 'Create audit logging middleware', users.dave, 'done'],
    [id('task'), reqs1[3][0], 'Build payment queue consumer', users.carol, 'done'],
    [id('task'), reqs1[3][0], 'Implement retry logic with backoff', users.dave, 'done'],
    [id('task'), reqs1[4][0], 'Build webhook delivery service', users.dave, 'done'],
    [id('task'), reqs1[5][0], 'Implement Stripe adapter', users.carol, 'done'],
    [id('task'), reqs1[6][0], 'Implement Adyen adapter', users.dave, 'done'],
    [id('task'), reqs1[7][0], 'Implement PayPal adapter', users.carol, 'done'],
    [id('task'), null, 'Write integration tests', users.dave, 'done'],
    [id('task'), null, 'Performance benchmarking', users.bob, 'done'],
    [id('task'), null, 'Security penetration testing', users.bob, 'done'],
  ];

  for (const [tid, reqId, title, assignee, status] of tasks1) {
    await client.query(
      'INSERT INTO tasks (id, org_id, flow_id, requirement_id, title, assignee_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [tid, orgId, flow1, reqId, title, assignee, status],
    );
  }

  // Artifacts (approved)
  const art1a = id('art');
  const art1b = id('art');
  await client.query('INSERT INTO artifacts (id, org_id, flow_id, type, title, status, approved_by, approved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
    [art1a, orgId, flow1, 'assessment', 'Assessment', 'approved', users.alice]);
  await client.query(
    `INSERT INTO artifact_versions (id, artifact_id, org_id, version, content, content_text, generated_by, token_usage) VALUES ($1,$2,$3,1,$4,$5,'ai',$6)`,
    [id('artv'), art1a, orgId,
      JSON.stringify({ sections: [
        { id: 'summary', title: 'Executive Summary', content: 'The Payment API v2 initiative aims to rebuild our payment processing infrastructure to achieve PCI-DSS Level 1 compliance while improving latency and adding multi-provider support.' },
        { id: 'risks', title: 'Risk Assessment', content: 'Key risks include data migration complexity, PCI audit timeline, and provider API stability.', risks: [{ description: 'Data migration may cause downtime', likelihood: 'medium', impact: 'high', mitigation: 'Blue-green deployment with rollback' }] },
        { id: 'recommendation', title: 'Recommendation', content: 'Proceed with phased rollout. Start with Stripe, then Adyen, then PayPal.', proceed: true },
      ]}),
      '# Assessment\n\n## Executive Summary\nThe Payment API v2 initiative aims to rebuild our payment processing infrastructure...\n\n## Risk Assessment\nKey risks include data migration complexity...\n\n## Recommendation\nProceed with phased rollout.',
      JSON.stringify({ input_tokens: 2400, output_tokens: 1800, model: 'claude-sonnet-4-6' })],
  );

  await client.query('INSERT INTO artifacts (id, org_id, flow_id, type, title, status, approved_by, approved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
    [art1b, orgId, flow1, 'prd', 'Product Requirements Document', 'approved', users.bob]);
  await client.query(
    `INSERT INTO artifact_versions (id, artifact_id, org_id, version, content, content_text, generated_by, token_usage) VALUES ($1,$2,$3,1,$4,$5,'ai',$6)`,
    [id('artv'), art1b, orgId,
      JSON.stringify({ sections: [
        { id: 'overview', title: 'Overview', content: 'This PRD defines the requirements for Payment API v2, a complete rebuild of our payment processing system.' },
        { id: 'requirements', title: 'Requirements', content: '8 requirements across security, performance, and functionality.' },
      ]}),
      '# PRD: Payment API v2\n\n## Overview\nThis PRD defines the requirements for Payment API v2...',
      JSON.stringify({ input_tokens: 3200, output_tokens: 2800, model: 'claude-sonnet-4-6' })],
  );

  // Evidence (all passing)
  const evidenceRows1 = [
    [reqs1[0][0], 'test_result', 'passing', { tool: 'vitest', tests_passed: 24, tests_failed: 0, coverage: 0.92 }],
    [reqs1[1][0], 'test_result', 'passing', { tool: 'vitest', tests_passed: 18, tests_failed: 0, coverage: 0.88 }],
    [reqs1[2][0], 'test_result', 'passing', { tool: 'vitest', tests_passed: 12, tests_failed: 0, coverage: 0.95 }],
    [reqs1[3][0], 'test_result', 'passing', { tool: 'vitest', tests_passed: 31, tests_failed: 0, coverage: 0.87 }],
    [reqs1[5][0], 'test_result', 'passing', { tool: 'vitest', tests_passed: 22, tests_failed: 0, coverage: 0.91 }],
    [reqs1[6][0], 'test_result', 'passing', { tool: 'vitest', tests_passed: 19, tests_failed: 0, coverage: 0.89 }],
    [reqs1[7][0], 'test_result', 'passing', { tool: 'vitest', tests_passed: 15, tests_failed: 0, coverage: 0.85 }],
    [null, 'security_scan', 'passing', { tool: 'snyk', critical: 0, high: 0, medium: 1, low: 3 }],
    [null, 'code_review', 'passing', { reviewer: 'bob@meridian.dev', pr_number: 42, review_state: 'approved' }],
    [null, 'deployment', 'passing', { environment: 'production', state: 'success', sha: 'a1b2c3d' }],
  ];

  for (const [reqId, type, status, data] of evidenceRows1) {
    await client.query(
      'INSERT INTO evidence (id, org_id, flow_id, requirement_id, type, source, status, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id('evi'), orgId, flow1, reqId, type, type === 'deployment' ? 'ci_cd' : type === 'code_review' ? 'github' : 'ci_cd', status, JSON.stringify(data)],
    );
  }
  console.log('  ✓ Flow 1: "Payment API v2" (DONE) — 3 objectives, 8 requirements, 12 tasks, 2 artifacts, 10 evidence');

  // ──────────────────────────────────────────────
  // FLOW 2: User Authentication Revamp (BUILD stage)
  // ──────────────────────────────────────────────
  const flow2 = id('flow');
  await client.query(
    `INSERT INTO flows (id, org_id, title, description, current_stage, status, priority, sensitivity, owner_id, team_id, tags)
     VALUES ($1, $2, $3, $4, 'build', 'active', 'high', 'high', $5, $6, $7)`,
    [flow2, orgId, 'User Authentication Revamp', 'Replace session-based auth with JWT + refresh tokens. Add MFA support and SSO preparation.', users.bob, teams.platform, ['auth', 'security', 'sso']],
  );

  for (const [from, to, by] of [[null, 'assess', users.bob], ['assess', 'plan', users.bob], ['plan', 'build', users.alice]] as [string|null, string, string][]) {
    await client.query('INSERT INTO flow_stage_transitions (id, flow_id, org_id, from_stage, to_stage, triggered_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [id('fst'), flow2, orgId, from, to, by]);
  }

  const init2 = id('init');
  await client.query('INSERT INTO initiatives (id, org_id, flow_id, title, description) VALUES ($1,$2,$3,$4,$5)',
    [init2, orgId, flow2, 'Harden Authentication System', 'Modernize auth to support enterprise SSO and improve security posture']);

  const obj2a = id('obj');
  const obj2b = id('obj');
  await client.query('INSERT INTO objectives (id, org_id, initiative_id, title, success_criteria) VALUES ($1,$2,$3,$4,$5)',
    [obj2a, orgId, init2, 'Implement JWT Auth', 'All endpoints use JWT with < 1s verification']);
  await client.query('INSERT INTO objectives (id, org_id, initiative_id, title, success_criteria) VALUES ($1,$2,$3,$4,$5)',
    [obj2b, orgId, init2, 'Add MFA Support', 'TOTP-based MFA available for all users']);

  const reqs2: any[] = [
    [id('req'), obj2a, 'JWT token issuance and validation', 'functional', 'must', 'implemented'],
    [id('req'), obj2a, 'Refresh token rotation', 'functional', 'must', 'implemented'],
    [id('req'), obj2a, 'Token revocation on password change', 'security', 'must', 'approved'],
    [id('req'), obj2b, 'TOTP enrollment flow', 'functional', 'must', 'draft'],
    [id('req'), obj2b, 'MFA challenge on login', 'functional', 'must', 'draft'],
    [id('req'), obj2b, 'Recovery codes generation', 'functional', 'should', 'draft'],
  ];

  for (const [rid, objId, title, type, priority, status] of reqs2) {
    await client.query(
      'INSERT INTO requirements (id, org_id, flow_id, objective_id, title, type, priority, status, acceptance_criteria) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [rid, orgId, flow2, objId, title, type, priority, status, '[]'],
    );
  }

  const tasks2 = [
    [id('task'), reqs2[0][0], 'Implement JWT middleware', users.bob, 'done'],
    [id('task'), reqs2[1][0], 'Build refresh token rotation', users.bob, 'done'],
    [id('task'), reqs2[2][0], 'Implement token revocation', users.dave, 'in_progress'],
    [id('task'), reqs2[3][0], 'Build TOTP enrollment API', users.dave, 'todo'],
    [id('task'), reqs2[4][0], 'Build MFA challenge flow', users.bob, 'todo'],
    [id('task'), reqs2[5][0], 'Generate recovery codes', users.dave, 'todo'],
    [id('task'), null, 'Write auth middleware tests', users.bob, 'review'],
    [id('task'), null, 'Update API documentation', users.carol, 'todo'],
  ];

  for (const [tid, reqId, title, assignee, status] of tasks2) {
    await client.query('INSERT INTO tasks (id, org_id, flow_id, requirement_id, title, assignee_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [tid, orgId, flow2, reqId, title, assignee, status]);
  }

  // Artifacts
  const art2a = id('art');
  const art2b = id('art');
  await client.query('INSERT INTO artifacts (id, org_id, flow_id, type, title, status, approved_by, approved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
    [art2a, orgId, flow2, 'assessment', 'Assessment', 'approved', users.alice]);
  await client.query(`INSERT INTO artifact_versions (id, artifact_id, org_id, version, content, content_text, generated_by) VALUES ($1,$2,$3,1,$4,$5,'ai')`,
    [id('artv'), art2a, orgId, JSON.stringify({ sections: [{ id: 'summary', title: 'Summary', content: 'Auth revamp assessment complete. Recommend proceeding.' }] }), '# Assessment\nAuth revamp assessment complete.']);

  await client.query('INSERT INTO artifacts (id, org_id, flow_id, type, title, status, approved_by, approved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
    [art2b, orgId, flow2, 'prd', 'Product Requirements Document', 'approved', users.alice]);
  await client.query(`INSERT INTO artifact_versions (id, artifact_id, org_id, version, content, content_text, generated_by) VALUES ($1,$2,$3,1,$4,$5,'ai')`,
    [id('artv'), art2b, orgId, JSON.stringify({ sections: [{ id: 'overview', title: 'Overview', content: 'JWT + MFA authentication system.' }] }), '# PRD\nJWT + MFA authentication system.']);

  // Evidence (partial)
  await client.query('INSERT INTO evidence (id, org_id, flow_id, requirement_id, type, source, status, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id('evi'), orgId, flow2, reqs2[0][0], 'test_result', 'ci_cd', 'passing', JSON.stringify({ tests_passed: 18, tests_failed: 0, coverage: 0.91 })]);
  await client.query('INSERT INTO evidence (id, org_id, flow_id, requirement_id, type, source, status, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id('evi'), orgId, flow2, reqs2[1][0], 'test_result', 'ci_cd', 'passing', JSON.stringify({ tests_passed: 12, tests_failed: 0, coverage: 0.85 })]);
  await client.query('INSERT INTO evidence (id, org_id, flow_id, requirement_id, type, source, status, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id('evi'), orgId, flow2, null, 'code_review', 'github', 'passing', JSON.stringify({ reviewer: 'alice@meridian.dev', pr_number: 67 })]);

  console.log('  ✓ Flow 2: "User Auth Revamp" (BUILD) — 2 objectives, 6 requirements, 8 tasks, 2 artifacts, 3 evidence');

  // ──────────────────────────────────────────────
  // FLOW 3: Billing Dashboard (PLAN stage)
  // ──────────────────────────────────────────────
  const flow3 = id('flow');
  await client.query(
    `INSERT INTO flows (id, org_id, title, description, current_stage, status, priority, sensitivity, owner_id, team_id, tags)
     VALUES ($1, $2, $3, $4, 'plan', 'active', 'medium', 'medium', $5, $6, $7)`,
    [flow3, orgId, 'Billing Dashboard', 'Build a customer-facing billing dashboard showing invoices, usage, and payment history.', users.carol, teams.payments, ['billing', 'frontend', 'customer']],
  );

  for (const [from, to, by] of [[null, 'assess', users.carol], ['assess', 'plan', users.carol]] as [string|null, string, string][]) {
    await client.query('INSERT INTO flow_stage_transitions (id, flow_id, org_id, from_stage, to_stage, triggered_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [id('fst'), flow3, orgId, from, to, by]);
  }

  const init3 = id('init');
  await client.query('INSERT INTO initiatives (id, org_id, flow_id, title, description) VALUES ($1,$2,$3,$4,$5)',
    [init3, orgId, flow3, 'Self-Service Billing', 'Enable customers to manage their billing without support tickets']);

  const obj3a = id('obj');
  await client.query('INSERT INTO objectives (id, org_id, initiative_id, title, success_criteria) VALUES ($1,$2,$3,$4,$5)',
    [obj3a, orgId, init3, 'Invoice Visibility', 'Customers can view and download invoices']);

  const reqs3 = [
    [id('req'), obj3a, 'Display invoice history', 'functional', 'must', 'approved'],
    [id('req'), obj3a, 'Download PDF invoices', 'functional', 'must', 'draft'],
    [id('req'), obj3a, 'Usage breakdown chart', 'functional', 'should', 'draft'],
  ];
  for (const [rid, objId, title, type, priority, status] of reqs3) {
    await client.query('INSERT INTO requirements (id, org_id, flow_id, objective_id, title, type, priority, status, acceptance_criteria) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [rid, orgId, flow3, objId, title, type, priority, status, '[]']);
  }

  const art3 = id('art');
  await client.query('INSERT INTO artifacts (id, org_id, flow_id, type, title, status, approved_by, approved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
    [art3, orgId, flow3, 'assessment', 'Assessment', 'approved', users.alice]);
  await client.query(`INSERT INTO artifact_versions (id, artifact_id, org_id, version, content, content_text, generated_by) VALUES ($1,$2,$3,1,$4,$5,'ai')`,
    [id('artv'), art3, orgId, JSON.stringify({ sections: [{ id: 'summary', title: 'Summary', content: 'Billing dashboard is straightforward. Low risk, medium effort.' }] }), '# Assessment\nBilling dashboard. Low risk, medium effort.']);

  console.log('  ✓ Flow 3: "Billing Dashboard" (PLAN) — 1 objective, 3 requirements, 1 artifact');

  // ──────────────────────────────────────────────
  // FLOW 4: API Rate Limiting (ASSESS stage)
  // ──────────────────────────────────────────────
  const flow4 = id('flow');
  await client.query(
    `INSERT INTO flows (id, org_id, title, description, current_stage, status, priority, sensitivity, owner_id, team_id, tags)
     VALUES ($1, $2, $3, $4, 'assess', 'active', 'high', 'low', $5, $6, $7)`,
    [flow4, orgId, 'API Rate Limiting', 'Implement tiered rate limiting across all API endpoints. Prevent abuse and ensure fair usage.', users.bob, teams.platform, ['api', 'security', 'infrastructure']],
  );

  await client.query('INSERT INTO flow_stage_transitions (id, flow_id, org_id, from_stage, to_stage, triggered_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [id('fst'), flow4, orgId, null, 'assess', users.bob]);

  const art4 = id('art');
  await client.query('INSERT INTO artifacts (id, org_id, flow_id, type, title, status) VALUES ($1,$2,$3,$4,$5,$6)',
    [art4, orgId, flow4, 'assessment', 'Assessment', 'draft']);
  await client.query(`INSERT INTO artifact_versions (id, artifact_id, org_id, version, content, content_text, generated_by) VALUES ($1,$2,$3,1,$4,$5,'ai')`,
    [id('artv'), art4, orgId, JSON.stringify({ sections: [{ id: 'summary', title: 'Summary', content: 'Rate limiting assessment in progress. Evaluating Redis-based sliding window approach.' }] }), '# Assessment (Draft)\nRate limiting assessment in progress.']);

  console.log('  ✓ Flow 4: "API Rate Limiting" (ASSESS) — 1 draft artifact');

  // ──────────────────────────────────────────────
  // FLOW 5: Data Export Pipeline (RELEASE stage)
  // ──────────────────────────────────────────────
  const flow5 = id('flow');
  await client.query(
    `INSERT INTO flows (id, org_id, title, description, current_stage, status, priority, sensitivity, owner_id, team_id, tags)
     VALUES ($1, $2, $3, $4, 'release', 'active', 'medium', 'high', $5, $6, $7)`,
    [flow5, orgId, 'Data Export Pipeline', 'Build GDPR-compliant data export system. Users can request full data export in JSON/CSV.', users.dave, teams.platform, ['gdpr', 'compliance', 'data']],
  );

  for (const [from, to, by] of [[null, 'assess', users.dave], ['assess', 'plan', users.dave], ['plan', 'build', users.dave], ['build', 'release', users.alice]] as [string|null, string, string][]) {
    await client.query('INSERT INTO flow_stage_transitions (id, flow_id, org_id, from_stage, to_stage, triggered_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [id('fst'), flow5, orgId, from, to, by]);
  }

  const init5 = id('init');
  await client.query('INSERT INTO initiatives (id, org_id, flow_id, title) VALUES ($1,$2,$3,$4)',
    [init5, orgId, flow5, 'GDPR Compliance']);
  const obj5a = id('obj');
  await client.query('INSERT INTO objectives (id, org_id, initiative_id, title, success_criteria) VALUES ($1,$2,$3,$4,$5)',
    [obj5a, orgId, init5, 'User Data Portability', 'Users can export all their data within 72 hours']);

  const reqs5 = [
    [id('req'), obj5a, 'Export user data as JSON', 'functional', 'must', 'verified'],
    [id('req'), obj5a, 'Export user data as CSV', 'functional', 'must', 'verified'],
    [id('req'), obj5a, 'Email notification on export ready', 'functional', 'should', 'implemented'],
    [id('req'), obj5a, 'Encrypt export files at rest', 'security', 'must', 'verified'],
  ];
  for (const [rid, objId, title, type, priority, status] of reqs5) {
    await client.query('INSERT INTO requirements (id, org_id, flow_id, objective_id, title, type, priority, status, acceptance_criteria) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [rid, orgId, flow5, objId, title, type, priority, status, '[]']);
  }

  const tasks5 = [
    [id('task'), reqs5[0][0], 'Build JSON exporter', users.dave, 'done'],
    [id('task'), reqs5[1][0], 'Build CSV exporter', users.dave, 'done'],
    [id('task'), reqs5[2][0], 'Implement export notification emails', users.carol, 'done'],
    [id('task'), reqs5[3][0], 'Add encryption to export files', users.dave, 'done'],
    [id('task'), null, 'Write exporter integration tests', users.dave, 'done'],
  ];
  for (const [tid, reqId, title, assignee, status] of tasks5) {
    await client.query('INSERT INTO tasks (id, org_id, flow_id, requirement_id, title, assignee_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [tid, orgId, flow5, reqId, title, assignee, status]);
  }

  // Artifacts (approved)
  for (const type of ['assessment', 'prd']) {
    const aId = id('art');
    await client.query('INSERT INTO artifacts (id, org_id, flow_id, type, title, status, approved_by, approved_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
      [aId, orgId, flow5, type, type === 'assessment' ? 'Assessment' : 'PRD', 'approved', users.alice]);
    await client.query(`INSERT INTO artifact_versions (id, artifact_id, org_id, version, content, content_text, generated_by) VALUES ($1,$2,$3,1,$4,$5,'ai')`,
      [id('artv'), aId, orgId, JSON.stringify({ sections: [{ id: 'summary', title: 'Summary', content: `Data export ${type} content.` }] }), `# ${type}\nData export ${type} content.`]);
  }

  // Evidence — some passing, one failing (to demonstrate readiness gaps)
  await client.query('INSERT INTO evidence (id, org_id, flow_id, requirement_id, type, source, status, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id('evi'), orgId, flow5, reqs5[0][0], 'test_result', 'ci_cd', 'passing', JSON.stringify({ tests_passed: 14, coverage: 0.88 })]);
  await client.query('INSERT INTO evidence (id, org_id, flow_id, requirement_id, type, source, status, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id('evi'), orgId, flow5, reqs5[1][0], 'test_result', 'ci_cd', 'passing', JSON.stringify({ tests_passed: 11, coverage: 0.82 })]);
  await client.query('INSERT INTO evidence (id, org_id, flow_id, requirement_id, type, source, status, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id('evi'), orgId, flow5, reqs5[3][0], 'test_result', 'ci_cd', 'passing', JSON.stringify({ tests_passed: 8, coverage: 0.90 })]);
  await client.query('INSERT INTO evidence (id, org_id, flow_id, requirement_id, type, source, status, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id('evi'), orgId, flow5, null, 'security_scan', 'ci_cd', 'failing', JSON.stringify({ tool: 'snyk', critical: 1, high: 2, medium: 3, reason: '1 critical vulnerability in export encryption library' })]);

  console.log('  ✓ Flow 5: "Data Export Pipeline" (RELEASE) — 4 requirements, 5 tasks, 2 artifacts, 4 evidence (1 FAILING)');

  // ──────────────────────────────────────────────
  // FLOW 6: Mobile App Push Notifications (PAUSED)
  // ──────────────────────────────────────────────
  const flow6 = id('flow');
  await client.query(
    `INSERT INTO flows (id, org_id, title, description, current_stage, status, priority, sensitivity, owner_id, team_id, tags)
     VALUES ($1, $2, $3, $4, 'plan', 'paused', 'low', 'low', $5, $6, $7)`,
    [flow6, orgId, 'Mobile Push Notifications', 'Add push notification support for iOS and Android via Firebase Cloud Messaging.', users.carol, teams.platform, ['mobile', 'notifications']],
  );

  await client.query('INSERT INTO flow_stage_transitions (id, flow_id, org_id, from_stage, to_stage, triggered_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [id('fst'), flow6, orgId, null, 'assess', users.carol]);
  await client.query('INSERT INTO flow_stage_transitions (id, flow_id, org_id, from_stage, to_stage, triggered_by) VALUES ($1,$2,$3,$4,$5,$6)',
    [id('fst'), flow6, orgId, 'assess', 'plan', users.carol]);

  console.log('  ✓ Flow 6: "Mobile Push Notifications" (PAUSED at PLAN)');

  // ──────────────────────────────────────────────
  // EVENTS (sample audit trail)
  // ──────────────────────────────────────────────
  const eventRows = [
    ['flow', flow1, 'flow.created', users.alice],
    ['flow', flow1, 'flow.stage_changed', users.alice],
    ['artifact', art1a, 'artifact.approved', users.alice],
    ['flow', flow1, 'flow.stage_changed', users.alice],
    ['artifact', art1b, 'artifact.approved', users.bob],
    ['flow', flow1, 'flow.stage_changed', users.bob],
    ['flow', flow1, 'flow.stage_changed', users.alice],
    ['flow', flow2, 'flow.created', users.bob],
    ['flow', flow2, 'flow.stage_changed', users.bob],
    ['flow', flow2, 'flow.stage_changed', users.alice],
    ['flow', flow3, 'flow.created', users.carol],
    ['flow', flow3, 'flow.stage_changed', users.carol],
    ['flow', flow4, 'flow.created', users.bob],
    ['flow', flow5, 'flow.created', users.dave],
    ['flow', flow5, 'flow.stage_changed', users.dave],
    ['flow', flow5, 'flow.stage_changed', users.dave],
    ['flow', flow5, 'flow.stage_changed', users.alice],
    ['flow', flow6, 'flow.created', users.carol],
  ];

  for (const [entityType, entityId, eventType, actorId] of eventRows) {
    await client.query(
      'INSERT INTO events (id, org_id, entity_type, entity_id, event_type, actor_id, data) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id('evt'), orgId, entityType, entityId, eventType, actorId, '{}'],
    );
  }
  console.log('  ✓ Created 18 audit events');

  console.log('\n✅ UAT seed complete!\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  UAT Demo Accounts (password: demo1234)                ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  alice@meridian.dev  — Owner   (full access)           ║');
  console.log('║  bob@meridian.dev    — Admin   (manage + approve)      ║');
  console.log('║  carol@meridian.dev  — Member  (create + edit)         ║');
  console.log('║  dave@meridian.dev   — Member  (create + edit)         ║');
  console.log('║  eve@meridian.dev    — Viewer  (read only)             ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  6 Flows across all stages:                            ║');
  console.log('║    • Payment API v2          — DONE (complete)         ║');
  console.log('║    • User Auth Revamp        — BUILD (in progress)     ║');
  console.log('║    • Billing Dashboard       — PLAN                    ║');
  console.log('║    • API Rate Limiting       — ASSESS                  ║');
  console.log('║    • Data Export Pipeline     — RELEASE (has gaps!)     ║');
  console.log('║    • Mobile Push Notifs      — PAUSED                  ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  6 Policies, 5 Artifacts, 17 Evidence items            ║');
  console.log('║  17 Requirements, 25 Tasks, 18 Audit Events            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await client.end();
}

uatSeed().catch((err) => { console.error('UAT seed failed:', err); process.exit(1); });
