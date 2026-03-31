# Meridian — Policy Engine

## Overview

The Policy Engine enforces governance rules at stage transitions (gates). When a flow tries to advance from one stage to the next, all policies attached to that stage's gate are evaluated. Blocking policies must pass for the transition to proceed.

## Concepts

### Policy

A reusable rule that evaluates flow state, evidence, artifacts, or requirements to produce a pass/fail result.

### Gate

A checkpoint at a stage boundary. Each stage transition (assess→plan, plan→build, build→release) has a gate. Gates contain one or more policies.

### Evaluation

The process of running all gate policies against a flow's current state. Produces a verdict: pass (all blocking policies pass) or fail.

```
Flow requests stage transition
         │
         ▼
    ┌──────────┐     ┌──────────┐
    │  Gate    │────▶│  Policy  │──── pass/fail
    │ (stage)  │     │  Eval 1  │
    └──────────┘     └──────────┘
         │           ┌──────────┐
         ├──────────▶│  Policy  │──── pass/fail
         │           │  Eval 2  │
         │           └──────────┘
         │           ┌──────────┐
         └──────────▶│  Policy  │──── pass/fail
                     │  Eval N  │
                     └──────────┘
                          │
                     All blocking passed?
                     ┌────┴────┐
                     ▼         ▼
                  ADVANCE    BLOCK
```

## Policy Rule Language

Policies use a JSON-based rule language that is evaluated against a flow context object.

### Flow Context (Available Variables)

The policy engine builds a context object for each evaluation:

```typescript
interface PolicyContext {
  flow: {
    id: string;
    title: string;
    stage: string;
    status: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    sensitivity: 'low' | 'medium' | 'high';
    tags: string[];
    created_at: string;
  };
  artifacts: {
    count: number;
    types: string[];               // ['assessment', 'prd', ...]
    approved: string[];            // approved artifact types
    has: (type: string) => boolean;
    approved_has: (type: string) => boolean;
  };
  requirements: {
    total: number;
    by_status: Record<string, number>;  // { draft: 2, approved: 5, implemented: 3 }
    by_priority: Record<string, number>;
    implemented_ratio: number;          // 0.0 - 1.0
    verified_ratio: number;
  };
  tasks: {
    total: number;
    by_status: Record<string, number>;
    completion_ratio: number;
  };
  evidence: {
    total: number;
    by_type: Record<string, { total: number; passing: number; failing: number }>;
    by_status: Record<string, number>;
    coverage: number;              // requirements with passing evidence / total requirements
    has_type: (type: string) => boolean;
    all_passing: (type: string) => boolean;
  };
  approvals: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  };
}
```

### Rule Format

Rules use a declarative JSON structure:

```json
{
  "when": { ... },          // optional condition — if false, policy is skipped
  "require": { ... }        // the actual check — must be true to pass
}
```

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equals | `{ "flow.priority": { "$eq": "high" } }` |
| `$ne` | Not equals | `{ "flow.status": { "$ne": "cancelled" } }` |
| `$gt` | Greater than | `{ "evidence.coverage": { "$gt": 0.8 } }` |
| `$gte` | Greater or equal | `{ "tasks.completion_ratio": { "$gte": 0.9 } }` |
| `$lt` | Less than | ... |
| `$lte` | Less or equal | ... |
| `$in` | In array | `{ "flow.priority": { "$in": ["high", "critical"] } }` |
| `$nin` | Not in array | ... |
| `$contains` | Array contains | `{ "flow.tags": { "$contains": "security" } }` |
| `$exists` | Value exists | `{ "evidence.by_type.security_scan": { "$exists": true } }` |
| `$and` | All conditions true | `{ "$and": [ ... ] }` |
| `$or` | Any condition true | `{ "$or": [ ... ] }` |
| `$not` | Negate condition | `{ "$not": { ... } }` |

### Built-in Policy Templates

#### 1. Require Approved Assessment

```json
{
  "name": "require-approved-assessment",
  "description": "An assessment must be approved before moving to Plan",
  "stage": "assess",
  "severity": "blocking",
  "rules": {
    "require": {
      "artifacts.approved": { "$contains": "assessment" }
    }
  }
}
```

#### 2. Require Approved PRD

```json
{
  "name": "require-approved-prd",
  "description": "A PRD must be approved before moving to Build",
  "stage": "plan",
  "severity": "blocking",
  "rules": {
    "require": {
      "artifacts.approved": { "$contains": "prd" }
    }
  }
}
```

#### 3. Require Test Coverage

```json
{
  "name": "require-test-coverage",
  "description": "Evidence must show >= 80% test coverage before release",
  "stage": "release",
  "severity": "blocking",
  "rules": {
    "require": {
      "evidence.coverage": { "$gte": 0.8 }
    }
  }
}
```

#### 4. Require Security Scan for Sensitive Flows

```json
{
  "name": "require-security-scan-high",
  "description": "HIGH sensitivity flows must have a passing security scan",
  "stage": "release",
  "severity": "blocking",
  "rules": {
    "when": {
      "flow.sensitivity": { "$in": ["high"] }
    },
    "require": {
      "$and": [
        { "evidence.has_type": "security_scan" },
        { "evidence.all_passing": "security_scan" }
      ]
    }
  }
}
```

#### 5. Require All Tasks Complete

```json
{
  "name": "require-tasks-complete",
  "description": "All tasks must be done before release",
  "stage": "release",
  "severity": "blocking",
  "rules": {
    "require": {
      "tasks.completion_ratio": { "$eq": 1.0 }
    }
  }
}
```

#### 6. Require Approval for Critical Flows

```json
{
  "name": "require-approval-critical",
  "description": "Critical priority flows require explicit approval",
  "stage": "release",
  "severity": "blocking",
  "rules": {
    "when": {
      "flow.priority": { "$eq": "critical" }
    },
    "require": {
      "approvals.approved": { "$gte": 1 }
    }
  }
}
```

## Evaluation Engine

### Evaluation Process

```typescript
// policy/evaluator.ts
interface EvaluationResult {
  policy_id: string;
  policy_name: string;
  result: 'pass' | 'fail' | 'skip';
  severity: 'blocking' | 'warning' | 'info';
  details: {
    message: string;
    actual?: any;
    expected?: any;
  };
}

interface GateResult {
  passed: boolean;
  evaluations: EvaluationResult[];
  blocking_failures: EvaluationResult[];
  warnings: EvaluationResult[];
}

async function evaluateGate(flowId: string, stage: string): Promise<GateResult> {
  // 1. Load all enabled policies for this stage
  const policies = await policyRepo.findByStage(orgId, stage);

  // 2. Build the policy context
  const context = await buildPolicyContext(flowId);

  // 3. Evaluate each policy
  const evaluations = policies.map(policy => {
    // Check 'when' condition first
    if (policy.rules.when && !evaluateCondition(policy.rules.when, context)) {
      return { ...policy, result: 'skip', details: { message: 'Condition not met, skipped' } };
    }

    // Evaluate 'require' condition
    const passed = evaluateCondition(policy.rules.require, context);
    return {
      policy_id: policy.id,
      policy_name: policy.name,
      result: passed ? 'pass' : 'fail',
      severity: policy.severity,
      details: passed
        ? { message: 'Policy satisfied' }
        : buildFailureMessage(policy, context),
    };
  });

  // 4. Determine gate result
  const blockingFailures = evaluations.filter(
    e => e.result === 'fail' && e.severity === 'blocking'
  );

  return {
    passed: blockingFailures.length === 0,
    evaluations,
    blocking_failures: blockingFailures,
    warnings: evaluations.filter(e => e.result === 'fail' && e.severity === 'warning'),
  };
}
```

### Condition Evaluator

```typescript
// policy/condition-evaluator.ts
function evaluateCondition(condition: any, context: PolicyContext): boolean {
  if ('$and' in condition) {
    return condition.$and.every((c: any) => evaluateCondition(c, context));
  }
  if ('$or' in condition) {
    return condition.$or.some((c: any) => evaluateCondition(c, context));
  }
  if ('$not' in condition) {
    return !evaluateCondition(condition.$not, context);
  }

  // Field-level comparison
  for (const [field, check] of Object.entries(condition)) {
    const actualValue = getNestedValue(context, field);

    if (typeof check === 'object' && check !== null) {
      for (const [op, expected] of Object.entries(check as Record<string, any>)) {
        if (!applyOperator(op, actualValue, expected)) return false;
      }
    } else {
      // Shorthand: { "field": value } means { "field": { "$eq": value } }
      if (actualValue !== check) return false;
    }
  }

  return true;
}

function applyOperator(op: string, actual: any, expected: any): boolean {
  switch (op) {
    case '$eq': return actual === expected;
    case '$ne': return actual !== expected;
    case '$gt': return actual > expected;
    case '$gte': return actual >= expected;
    case '$lt': return actual < expected;
    case '$lte': return actual <= expected;
    case '$in': return Array.isArray(expected) && expected.includes(actual);
    case '$nin': return Array.isArray(expected) && !expected.includes(actual);
    case '$contains': return Array.isArray(actual) && actual.includes(expected);
    case '$exists': return expected ? actual !== undefined : actual === undefined;
    default: throw new Error(`Unknown operator: ${op}`);
  }
}
```

## Default Gate Configuration

New organizations get these default gates:

```json
{
  "gates": [
    {
      "stage": "assess",
      "name": "Assessment Gate",
      "policies": ["require-approved-assessment"]
    },
    {
      "stage": "plan",
      "name": "Planning Gate",
      "policies": ["require-approved-prd"]
    },
    {
      "stage": "build",
      "name": "Build Gate",
      "policies": ["require-tasks-complete"]
    },
    {
      "stage": "release",
      "name": "Release Gate",
      "policies": [
        "require-test-coverage",
        "require-security-scan-high",
        "require-approval-critical"
      ]
    }
  ]
}
```

## Policy Versioning

When a policy is updated, its `version` field increments. Gate evaluations record which policy version was used, ensuring audit traceability.

## Future: Policy DSL

Phase 2 will introduce a human-readable DSL that compiles to the JSON rule format:

```
policy "require-security-scan" {
  stage: release
  severity: blocking

  when flow.sensitivity in ["high"] {
    require evidence.type("security_scan").status == "passing"
  }
}
```

This will be implemented in the `packages/policy-dsl` package with a lexer, parser, and compiler.
