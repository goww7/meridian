import pg from 'pg';
import { ulid } from 'ulid';
import * as argon2 from 'argon2';

async function seed() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://meridian:meridian@localhost:5432/meridian',
  });
  await client.connect();

  const userId = `usr_${ulid().toLowerCase()}`;
  const orgId = `org_${ulid().toLowerCase()}`;
  const memberId = `mem_${ulid().toLowerCase()}`;
  const teamId = `team_${ulid().toLowerCase()}`;
  const flowId = `flow_${ulid().toLowerCase()}`;
  const passwordHash = await argon2.hash('password123');

  await client.query('BEGIN');

  // User
  await client.query(
    'INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
    [userId, 'admin@meridian.dev', 'Admin User', passwordHash],
  );

  // Org
  await client.query(
    'INSERT INTO orgs (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
    [orgId, 'Meridian Demo', 'meridian-demo'],
  );

  // Membership
  await client.query(
    'INSERT INTO org_members (id, org_id, user_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT (org_id, user_id) DO NOTHING',
    [memberId, orgId, userId, 'owner'],
  );

  // Team
  await client.query(
    'INSERT INTO teams (id, org_id, name, slug) VALUES ($1, $2, $3, $4) ON CONFLICT (org_id, slug) DO NOTHING',
    [teamId, orgId, 'Platform Team', 'platform'],
  );

  // Demo flow
  await client.query(
    `INSERT INTO flows (id, org_id, title, description, priority, sensitivity, owner_id, team_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
    [flowId, orgId, 'Payment API v2', 'Rebuild payment processing API for PCI compliance', 'high', 'high', userId, teamId],
  );

  // Default policies
  const policies = [
    { name: 'require-approved-assessment', stage: 'assess', severity: 'blocking', rules: { require: { 'artifacts.approved': { $contains: 'assessment' } } } },
    { name: 'require-approved-prd', stage: 'plan', severity: 'blocking', rules: { require: { 'artifacts.approved': { $contains: 'prd' } } } },
    { name: 'require-test-coverage', stage: 'release', severity: 'blocking', rules: { require: { 'evidence.coverage': { $gte: 0.8 } } } },
    { name: 'require-tasks-complete', stage: 'release', severity: 'blocking', rules: { require: { 'tasks.completion_ratio': { $eq: 1.0 } } } },
    { name: 'require-security-scan-high', stage: 'release', severity: 'blocking', rules: { when: { 'flow.sensitivity': { $in: ['high'] } }, require: { 'evidence.types_present': { $contains: 'security_scan' } } } },
  ];

  for (const p of policies) {
    await client.query(
      'INSERT INTO policies (id, org_id, name, stage, severity, rules) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (org_id, name) DO NOTHING',
      [`pol_${ulid().toLowerCase()}`, orgId, p.name, p.stage, p.severity, JSON.stringify(p.rules)],
    );
  }

  await client.query('COMMIT');
  console.log('Seed data inserted.');
  console.log(`  Email: admin@meridian.dev`);
  console.log(`  Password: password123`);
  console.log(`  Org: Meridian Demo (${orgId})`);
  await client.end();
}

seed();
