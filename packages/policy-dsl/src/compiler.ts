/**
 * Policy DSL Compiler
 *
 * Compiles a PolicyAST into JSON rules compatible with the policy evaluator.
 */

import type { PolicyAST, ConditionNode } from './parser.js';
import type { PolicyRules } from './types.js';

export interface CompiledPolicy {
  name: string;
  stage: string;
  severity: string;
  description?: string;
  rules: PolicyRules;
}

const OPERATOR_MAP: Record<string, string> = {
  '==': '$eq',
  '!=': '$ne',
  '>': '$gt',
  '>=': '$gte',
  '<': '$lt',
  '<=': '$lte',
  'in': '$in',
  'not_in': '$nin',
  'contains': '$contains',
  'exists': '$exists',
};

function compileCondition(condition: ConditionNode): Record<string, unknown> {
  const jsonOp = OPERATOR_MAP[condition.operator];
  if (!jsonOp) throw new Error(`Unknown operator: ${condition.operator}`);

  // Direct equality uses no operator wrapper
  if (jsonOp === '$eq') {
    return { [condition.field]: condition.value };
  }

  return { [condition.field]: { [jsonOp]: condition.value } };
}

function compileConditions(conditions: ConditionNode[]): Record<string, unknown> {
  if (conditions.length === 1) return compileCondition(conditions[0]!);

  // Multiple conditions become $and
  return { $and: conditions.map(compileCondition) };
}

export function compile(ast: PolicyAST): CompiledPolicy {
  const rules: PolicyRules = {
    require: compileConditions(ast.require),
  };

  if (ast.when && ast.when.length > 0) {
    rules.when = compileConditions(ast.when);
  }

  return {
    name: ast.name,
    stage: ast.stage,
    severity: ast.severity,
    description: ast.description,
    rules,
  };
}

export function compileMultiple(asts: PolicyAST[]): CompiledPolicy[] {
  return asts.map(compile);
}

/**
 * Convenience: parse DSL text and compile to JSON in one step.
 */
export { parsePolicy, parsePolicies } from './parser.js';
