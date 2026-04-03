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

const FIELD_LABELS: Record<string, string> = {
  'evidence.coverage': 'evidence coverage',
  'evidence.total': 'total evidence items',
  'evidence.types_present': 'evidence types present',
  'evidence.types_passing': 'evidence types passing',
  'tasks.completion_ratio': 'task completion rate',
  'tasks.total': 'total tasks',
  'requirements.implemented_ratio': 'requirements implemented rate',
  'requirements.verified_ratio': 'requirements verified rate',
  'requirements.total': 'total requirements',
  'artifacts.count': 'total artifacts',
  'approvals.approved': 'approved approvals',
  'approvals.pending': 'pending approvals',
  'approvals.rejected': 'rejected approvals',
  'flow.priority': 'flow priority',
  'flow.sensitivity': 'flow sensitivity',
  'flow.status': 'flow status',
};

const OP_LABELS: Record<string, string> = {
  '$eq': 'equal to',
  '$ne': 'not equal to',
  '$gt': 'greater than',
  '$gte': 'at least',
  '$lt': 'less than',
  '$lte': 'at most',
  '$in': 'one of',
  '$nin': 'not one of',
  '$contains': 'containing',
  '$exists': 'present',
};

function formatValue(value: unknown, field?: string): string {
  if (typeof value === 'number' && field && (field.includes('ratio') || field.includes('coverage'))) {
    return `${Math.round(value * 100)}%`;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(', ');
  return JSON.stringify(value);
}

function buildFailureDetail(
  require: Record<string, unknown>,
  context: PolicyContext,
): { message: string; actual?: unknown; expected?: unknown; field?: string } {
  for (const [key, value] of Object.entries(require)) {
    if (key.startsWith('$')) continue;

    const actual = getNestedValue(context, key);
    const label = FIELD_LABELS[key] || key.replace(/\./g, ' ');

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, expected] of Object.entries(value as Record<string, unknown>)) {
        if (!applyOperator(op, actual, expected)) {
          const opLabel = OP_LABELS[op] || op;
          return {
            message: `${label} is ${formatValue(actual, key)}, must be ${opLabel} ${formatValue(expected, key)}`,
            field: key,
            actual,
            expected,
          };
        }
      }
    } else {
      if (actual !== value) {
        return {
          message: `${label} is ${formatValue(actual, key)}, expected ${formatValue(value, key)}`,
          field: key,
          actual,
          expected: value,
        };
      }
    }
  }

  return { message: 'Policy requirement not met' };
}
