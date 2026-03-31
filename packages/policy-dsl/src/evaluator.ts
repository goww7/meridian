import type { PolicyContext, PolicyRules, EvaluationResult } from './types.js';

export function evaluate(rules: PolicyRules, context: PolicyContext): EvaluationResult {
  // Check 'when' condition — if not met, skip this policy
  if (rules.when) {
    const whenResult = evaluateCondition(rules.when, context);
    if (!whenResult) {
      return { result: 'skip', details: { message: 'Condition not met, policy skipped' } };
    }
  }

  // Evaluate 'require' condition
  const requireResult = evaluateCondition(rules.require, context);
  if (requireResult) {
    return { result: 'pass', details: { message: 'Policy satisfied' } };
  }

  // Build failure message
  const failureDetail = buildFailureDetail(rules.require, context);
  return { result: 'fail', details: failureDetail };
}

export function evaluateCondition(condition: Record<string, unknown>, context: PolicyContext): boolean {
  for (const [key, value] of Object.entries(condition)) {
    if (key === '$and') {
      const conditions = value as Record<string, unknown>[];
      if (!conditions.every((c) => evaluateCondition(c, context))) return false;
      continue;
    }

    if (key === '$or') {
      const conditions = value as Record<string, unknown>[];
      if (!conditions.some((c) => evaluateCondition(c, context))) return false;
      continue;
    }

    if (key === '$not') {
      if (evaluateCondition(value as Record<string, unknown>, context)) return false;
      continue;
    }

    const actual = getNestedValue(context, key);

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Operator object like { "$gte": 0.8 }
      for (const [op, expected] of Object.entries(value as Record<string, unknown>)) {
        if (!applyOperator(op, actual, expected)) return false;
      }
    } else {
      // Direct equality: { "flow.priority": "high" }
      if (actual !== value) return false;
    }
  }

  return true;
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function applyOperator(op: string, actual: unknown, expected: unknown): boolean {
  switch (op) {
    case '$eq':
      return actual === expected;
    case '$ne':
      return actual !== expected;
    case '$gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case '$gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case '$lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case '$lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case '$in':
      return Array.isArray(expected) && expected.includes(actual);
    case '$nin':
      return Array.isArray(expected) && !expected.includes(actual);
    case '$contains':
      return Array.isArray(actual) && actual.includes(expected);
    case '$exists':
      return expected ? actual !== undefined && actual !== null : actual === undefined || actual === null;
    default:
      throw new Error(`Unknown policy operator: ${op}`);
  }
}

function buildFailureDetail(
  require: Record<string, unknown>,
  context: PolicyContext,
): { message: string; actual?: unknown; expected?: unknown; field?: string } {
  for (const [key, value] of Object.entries(require)) {
    if (key.startsWith('$')) continue;

    const actual = getNestedValue(context, key);

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, expected] of Object.entries(value as Record<string, unknown>)) {
        if (!applyOperator(op, actual, expected)) {
          return {
            message: `Field '${key}' with value ${JSON.stringify(actual)} does not satisfy ${op} ${JSON.stringify(expected)}`,
            field: key,
            actual,
            expected,
          };
        }
      }
    } else {
      if (actual !== value) {
        return {
          message: `Field '${key}' expected ${JSON.stringify(value)} but got ${JSON.stringify(actual)}`,
          field: key,
          actual,
          expected: value,
        };
      }
    }
  }

  return { message: 'Policy requirement not met' };
}
