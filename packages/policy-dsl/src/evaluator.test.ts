import { describe, it, expect } from 'vitest';
import { evaluate, evaluateCondition } from './evaluator.js';
import type { PolicyContext, PolicyRules } from './types.js';

function makeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    flow: {
      id: 'flow_01',
      title: 'Test Flow',
      stage: 'release',
      status: 'active',
      priority: 'high',
      sensitivity: 'high',
      tags: ['security', 'payments'],
    },
    artifacts: {
      count: 3,
      types: ['assessment', 'prd', 'architecture'],
      approved: ['assessment', 'prd'],
    },
    requirements: {
      total: 10,
      by_status: { draft: 2, approved: 3, implemented: 3, verified: 2 },
      by_priority: { must: 6, should: 3, could: 1 },
      implemented_ratio: 0.5,
      verified_ratio: 0.2,
    },
    tasks: {
      total: 15,
      by_status: { todo: 2, in_progress: 3, review: 2, done: 8 },
      completion_ratio: 8 / 15,
    },
    evidence: {
      total: 12,
      by_type: {
        test_result: { total: 5, passing: 5, failing: 0 },
        security_scan: { total: 2, passing: 1, failing: 1 },
        code_review: { total: 3, passing: 3, failing: 0 },
      },
      by_status: { passing: 9, failing: 1, pending: 2 },
      coverage: 0.85,
      types_present: ['test_result', 'security_scan', 'code_review'],
      types_passing: ['test_result', 'code_review'],
    },
    approvals: {
      total: 3,
      approved: 2,
      pending: 1,
      rejected: 0,
    },
    ...overrides,
  };
}

describe('evaluateCondition', () => {
  const ctx = makeContext();

  it('evaluates direct equality', () => {
    expect(evaluateCondition({ 'flow.priority': 'high' }, ctx)).toBe(true);
    expect(evaluateCondition({ 'flow.priority': 'low' }, ctx)).toBe(false);
  });

  it('evaluates $eq operator', () => {
    expect(evaluateCondition({ 'flow.priority': { $eq: 'high' } }, ctx)).toBe(true);
  });

  it('evaluates $ne operator', () => {
    expect(evaluateCondition({ 'flow.priority': { $ne: 'low' } }, ctx)).toBe(true);
    expect(evaluateCondition({ 'flow.priority': { $ne: 'high' } }, ctx)).toBe(false);
  });

  it('evaluates $gt / $gte', () => {
    expect(evaluateCondition({ 'evidence.coverage': { $gte: 0.8 } }, ctx)).toBe(true);
    expect(evaluateCondition({ 'evidence.coverage': { $gt: 0.9 } }, ctx)).toBe(false);
    expect(evaluateCondition({ 'evidence.coverage': { $gte: 0.85 } }, ctx)).toBe(true);
  });

  it('evaluates $lt / $lte', () => {
    expect(evaluateCondition({ 'evidence.coverage': { $lte: 0.9 } }, ctx)).toBe(true);
    expect(evaluateCondition({ 'evidence.coverage': { $lt: 0.85 } }, ctx)).toBe(false);
  });

  it('evaluates $in operator', () => {
    expect(evaluateCondition({ 'flow.priority': { $in: ['high', 'critical'] } }, ctx)).toBe(true);
    expect(evaluateCondition({ 'flow.priority': { $in: ['low', 'medium'] } }, ctx)).toBe(false);
  });

  it('evaluates $nin operator', () => {
    expect(evaluateCondition({ 'flow.priority': { $nin: ['low'] } }, ctx)).toBe(true);
  });

  it('evaluates $contains operator', () => {
    expect(evaluateCondition({ 'flow.tags': { $contains: 'security' } }, ctx)).toBe(true);
    expect(evaluateCondition({ 'flow.tags': { $contains: 'unknown' } }, ctx)).toBe(false);
  });

  it('evaluates $exists operator', () => {
    expect(evaluateCondition({ 'flow.title': { $exists: true } }, ctx)).toBe(true);
    expect(evaluateCondition({ 'flow.nonexistent': { $exists: false } }, ctx)).toBe(true);
  });

  it('evaluates $and', () => {
    expect(evaluateCondition({
      $and: [
        { 'flow.priority': 'high' },
        { 'evidence.coverage': { $gte: 0.8 } },
      ],
    }, ctx)).toBe(true);

    expect(evaluateCondition({
      $and: [
        { 'flow.priority': 'low' },
        { 'evidence.coverage': { $gte: 0.8 } },
      ],
    }, ctx)).toBe(false);
  });

  it('evaluates $or', () => {
    expect(evaluateCondition({
      $or: [
        { 'flow.priority': 'low' },
        { 'flow.priority': 'high' },
      ],
    }, ctx)).toBe(true);

    expect(evaluateCondition({
      $or: [
        { 'flow.priority': 'low' },
        { 'flow.priority': 'medium' },
      ],
    }, ctx)).toBe(false);
  });

  it('evaluates $not', () => {
    expect(evaluateCondition({ $not: { 'flow.priority': 'low' } }, ctx)).toBe(true);
    expect(evaluateCondition({ $not: { 'flow.priority': 'high' } }, ctx)).toBe(false);
  });

  it('evaluates nested paths', () => {
    expect(evaluateCondition({ 'evidence.by_type.test_result.passing': { $gte: 5 } }, ctx)).toBe(true);
  });
});

describe('evaluate (full policy)', () => {
  const ctx = makeContext();

  it('passes when require condition is met', () => {
    const rules: PolicyRules = {
      require: { 'evidence.coverage': { $gte: 0.8 } },
    };
    const result = evaluate(rules, ctx);
    expect(result.result).toBe('pass');
  });

  it('fails when require condition is not met', () => {
    const rules: PolicyRules = {
      require: { 'tasks.completion_ratio': { $eq: 1.0 } },
    };
    const result = evaluate(rules, ctx);
    expect(result.result).toBe('fail');
    expect(result.details.field).toBe('tasks.completion_ratio');
  });

  it('skips when when-condition is not met', () => {
    const rules: PolicyRules = {
      when: { 'flow.sensitivity': 'low' },
      require: { 'evidence.coverage': { $gte: 0.99 } },
    };
    const result = evaluate(rules, ctx);
    expect(result.result).toBe('skip');
  });

  it('evaluates when when-condition is met', () => {
    const rules: PolicyRules = {
      when: { 'flow.sensitivity': 'high' },
      require: { 'artifacts.approved': { $contains: 'assessment' } },
    };
    const result = evaluate(rules, ctx);
    expect(result.result).toBe('pass');
  });

  it('handles require-approved-assessment policy', () => {
    const rules: PolicyRules = {
      require: { 'artifacts.approved': { $contains: 'assessment' } },
    };
    expect(evaluate(rules, ctx).result).toBe('pass');
  });

  it('handles require-test-coverage policy', () => {
    const rules: PolicyRules = {
      require: { 'evidence.coverage': { $gte: 0.8 } },
    };
    expect(evaluate(rules, ctx).result).toBe('pass');
  });

  it('handles conditional security scan policy', () => {
    const rules: PolicyRules = {
      when: { 'flow.sensitivity': { $in: ['high'] } },
      require: {
        $and: [
          { 'evidence.types_present': { $contains: 'security_scan' } },
          { 'evidence.types_passing': { $contains: 'security_scan' } },
        ],
      },
    };
    // security_scan has 1 failing, so types_passing doesn't include it
    expect(evaluate(rules, ctx).result).toBe('fail');
  });
});
