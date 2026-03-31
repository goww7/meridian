# Meridian — Testing Strategy

## Overview

Meridian uses a layered testing approach: unit tests for business logic, integration tests for API endpoints and database queries, and end-to-end tests for critical user flows.

## Test Stack

| Tool | Purpose |
|------|---------|
| Vitest | Unit and integration tests (API + shared packages) |
| Vitest (jsdom) | Component tests (frontend) |
| Playwright | End-to-end browser tests |
| Supertest | HTTP-level API integration tests |
| testcontainers | Disposable PostgreSQL + Redis for CI |

## Testing Pyramid

```
          ┌──────────┐
          │   E2E    │    ~20 tests
          │(Playwright│    Critical user journeys
          └────┬─────┘
               │
        ┌──────┴──────┐
        │ Integration │    ~150 tests
        │  (API +DB)  │    Every endpoint, DB queries
        └──────┬──────┘
               │
     ┌─────────┴─────────┐
     │      Unit         │    ~300 tests
     │ (services, utils, │    Business logic, policy engine,
     │  policy DSL)      │    AI prompt building, graph queries
     └───────────────────┘
```

## Coverage Targets

| Area | Target | Rationale |
|------|--------|-----------|
| `packages/shared` | 95% | Shared validation, must be rock solid |
| `packages/policy-dsl` | 95% | Policy evaluation correctness is critical |
| `apps/api/src/modules/*/service` | 90% | Core business logic |
| `apps/api/src/modules/*/repository` | 80% | DB layer, tested via integration |
| `apps/api/src/ai/` | 80% | Context building and prompt rendering (mock Claude API) |
| `apps/api/src/graph/` | 85% | Graph queries (tested against real AGE) |
| `apps/web/src/components/` | 70% | UI components |
| Overall | 80% | Minimum for release gate |

## Unit Tests

### What to Unit Test

- Service layer business logic (flow transitions, policy evaluation, evidence aggregation)
- Policy DSL parser and evaluator
- Zod schemas (valid and invalid inputs)
- Utility functions
- Event handlers (verify correct events emitted)
- AI context builder and prompt renderer (mock external calls)

### Conventions

```typescript
// modules/flows/flows.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowService } from './flows.service';

describe('FlowService', () => {
  let service: FlowService;
  let mockRepo: MockFlowRepository;
  let mockEventBus: MockEventBus;

  beforeEach(() => {
    mockRepo = createMockFlowRepository();
    mockEventBus = createMockEventBus();
    service = new FlowService(mockRepo, mockEventBus);
  });

  describe('transitionStage', () => {
    it('should advance from assess to plan when gate passes', async () => {
      mockRepo.findById.mockResolvedValue(makeFlow({ current_stage: 'assess' }));
      mockGateEvaluator.evaluate.mockResolvedValue({ passed: true, evaluations: [] });

      const result = await service.transitionStage('flow_01', 'plan', 'usr_01');

      expect(result.flow.current_stage).toBe('plan');
      expect(mockEventBus.emit).toHaveBeenCalledWith('flow.stage_changed', expect.any(Object));
    });

    it('should reject transition when blocking gate fails', async () => {
      mockRepo.findById.mockResolvedValue(makeFlow({ current_stage: 'assess' }));
      mockGateEvaluator.evaluate.mockResolvedValue({
        passed: false,
        evaluations: [{ result: 'fail', severity: 'blocking' }],
      });

      await expect(service.transitionStage('flow_01', 'plan', 'usr_01'))
        .rejects.toThrow(GateFailedError);
    });

    it('should not allow skipping stages', async () => {
      mockRepo.findById.mockResolvedValue(makeFlow({ current_stage: 'assess' }));

      await expect(service.transitionStage('flow_01', 'build', 'usr_01'))
        .rejects.toThrow(InvalidTransitionError);
    });
  });
});
```

### Test Factories

```typescript
// tests/factories.ts
import { ulid } from 'ulid';

export function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: `flow_${ulid()}`,
    org_id: `org_${ulid()}`,
    title: 'Test Flow',
    description: 'A test flow',
    current_stage: 'assess',
    status: 'active',
    priority: 'medium',
    sensitivity: 'low',
    owner_id: `usr_${ulid()}`,
    team_id: null,
    tags: [],
    metadata: {},
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  };
}

export function makeArtifact(overrides: Partial<Artifact> = {}): Artifact { /* ... */ }
export function makeRequirement(overrides: Partial<Requirement> = {}): Requirement { /* ... */ }
export function makeEvidence(overrides: Partial<Evidence> = {}): Evidence { /* ... */ }
export function makePolicy(overrides: Partial<Policy> = {}): Policy { /* ... */ }
```

## Integration Tests

### API Endpoint Tests

Every API endpoint has integration tests that run against a real PostgreSQL + Redis instance.

```typescript
// modules/flows/flows.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../server';
import { setupTestDatabase, teardownTestDatabase } from '../../tests/setup';

describe('Flow API', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await buildApp();
    authToken = await createTestUser(app);
  });

  afterAll(async () => {
    await app.close();
    await teardownTestDatabase();
  });

  describe('POST /api/v1/flows', () => {
    it('should create a flow', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/flows',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { title: 'Test Flow', priority: 'high', sensitivity: 'low' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.title).toBe('Test Flow');
      expect(body.current_stage).toBe('assess');
      expect(body.id).toMatch(/^flow_/);
    });

    it('should reject invalid input', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/flows',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { priority: 'invalid' },  // missing title, invalid priority
      });

      expect(res.statusCode).toBe(422);
    });

    it('should require authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/flows',
        payload: { title: 'Test' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/flows/:flowId/transition', () => {
    it('should advance stage when gate passes', async () => {
      // Create flow
      const flow = await createTestFlow(app, authToken);
      // Create and approve required assessment artifact
      await createApprovedArtifact(app, authToken, flow.id, 'assessment');

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/flows/${flow.id}/transition`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { to_stage: 'plan' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.flow.current_stage).toBe('plan');
      expect(body.gate_result.passed).toBe(true);
    });
  });
});
```

### Database Test Setup

```typescript
// tests/setup.ts
import { Client } from 'pg';

const TEST_DB = 'meridian_test';

export async function setupTestDatabase() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Run migrations
  await runMigrations(client);

  // Initialize AGE graph
  await client.query("LOAD 'age'");
  await client.query("SET search_path = ag_catalog, '$user', public");
  await client.query("SELECT create_graph('meridian_graph')");

  await client.end();
}

export async function teardownTestDatabase() {
  // Drop and recreate test database for clean state
}

// Per-test cleanup (truncate tables, not drop)
export async function cleanTestData(client: Client) {
  await client.query(`
    TRUNCATE flows, artifacts, artifact_versions, requirements, tasks,
    evidence, policies, policy_evaluations, events CASCADE
  `);
}
```

## End-to-End Tests

### Critical User Journeys

```typescript
// tests/e2e/flow-lifecycle.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Flow Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('complete flow from assess to release', async ({ page }) => {
    // 1. Create a new flow
    await page.goto('/flows');
    await page.click('button:has-text("New Flow")');
    await page.fill('input[name="title"]', 'E2E Test Flow');
    await page.selectOption('select[name="priority"]', 'high');
    await page.click('button:has-text("Create")');
    await expect(page.locator('[data-testid="flow-stage"]')).toHaveText('assess');

    // 2. Generate assessment
    await page.click('button:has-text("Generate Assessment")');
    await expect(page.locator('[data-testid="artifact-status"]')).toHaveText('draft', { timeout: 30000 });

    // 3. Approve assessment
    await page.click('button:has-text("Approve")');
    await expect(page.locator('[data-testid="artifact-status"]')).toHaveText('approved');

    // 4. Advance to Plan
    await page.click('button:has-text("Advance to Plan")');
    await expect(page.locator('[data-testid="flow-stage"]')).toHaveText('plan');

    // ... continue through stages
  });

  test('gate blocks stage transition when policy fails', async ({ page }) => {
    // Create flow, try to advance without meeting requirements
    await page.goto('/flows');
    const flow = await createFlowViaUI(page, 'Gate Test Flow');

    // Try to advance without approved assessment
    await page.click('button:has-text("Advance to Plan")');
    await expect(page.locator('[data-testid="gate-failure"]')).toBeVisible();
    await expect(page.locator('[data-testid="flow-stage"]')).toHaveText('assess');
  });
});
```

### E2E Test Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,      // Sequential — shared DB state
  retries: 1,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm dev --filter=api',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm dev --filter=web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

## Policy Engine Tests

The policy engine gets its own comprehensive test suite:

```typescript
// packages/policy-dsl/src/evaluator.test.ts
describe('PolicyEvaluator', () => {
  const context: PolicyContext = {
    flow: { priority: 'high', sensitivity: 'high', stage: 'release', tags: ['security'] },
    evidence: {
      coverage: 0.85,
      has_type: (t) => t === 'security_scan',
      all_passing: (t) => t === 'security_scan',
      by_type: { security_scan: { total: 1, passing: 1, failing: 0 } },
    },
    tasks: { completion_ratio: 1.0 },
    // ...
  };

  it('evaluates $gte operator', () => {
    const rule = { require: { 'evidence.coverage': { '$gte': 0.8 } } };
    expect(evaluate(rule, context)).toBe(true);
  });

  it('evaluates conditional when clause', () => {
    const rule = {
      when: { 'flow.sensitivity': { '$eq': 'high' } },
      require: { 'evidence.has_type': 'security_scan' },
    };
    expect(evaluate(rule, context)).toBe(true);
  });

  it('skips rule when condition not met', () => {
    const rule = {
      when: { 'flow.sensitivity': { '$eq': 'low' } },
      require: { 'evidence.has_type': 'security_scan' },
    };
    expect(evaluate(rule, context)).toBe('skip');
  });

  it('evaluates $and operator', () => {
    const rule = {
      require: {
        '$and': [
          { 'evidence.coverage': { '$gte': 0.8 } },
          { 'tasks.completion_ratio': { '$eq': 1.0 } },
        ],
      },
    };
    expect(evaluate(rule, context)).toBe(true);
  });
});
```

## AI Tests

AI generation is tested with mocked Claude API responses:

```typescript
// ai/agent.test.ts
describe('AI Agent', () => {
  it('builds correct context for assessment generation', async () => {
    const flow = makeFlow({ title: 'Test', sensitivity: 'high' });
    const context = await buildContext(flow.id, 'assessment');

    expect(context.flow.title).toBe('Test');
    expect(context.flow.sensitivity).toBe('high');
  });

  it('renders prompt with flow context', async () => {
    const prompt = await renderPrompt('assessment', mockContext);

    expect(prompt).toContain('Test Flow');
    expect(prompt).toContain('high');
    expect(prompt).toContain('assessment');
  });

  it('validates generated artifact structure', () => {
    const valid = { sections: [{ id: 'summary', title: 'Summary', content: '...' }] };
    expect(() => validateArtifactStructure('assessment', valid)).not.toThrow();

    const invalid = { sections: 'not an array' };
    expect(() => validateArtifactStructure('assessment', invalid)).toThrow();
  });
});
```

## Running Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests (requires running PostgreSQL + Redis)
pnpm test:integration

# E2E tests (requires running dev servers)
pnpm test:e2e

# Specific package
pnpm test --filter=@meridian/policy-dsl

# Watch mode
pnpm test -- --watch

# Coverage report
pnpm test -- --coverage
```

## CI Test Configuration

```json
// vitest.config.ts
{
  "test": {
    "globals": true,
    "environment": "node",
    "include": ["src/**/*.test.ts"],
    "coverage": {
      "provider": "v8",
      "reporter": ["text", "lcov"],
      "thresholds": {
        "global": { "branches": 75, "functions": 80, "lines": 80, "statements": 80 }
      }
    },
    "setupFiles": ["./tests/setup.ts"]
  }
}
```
