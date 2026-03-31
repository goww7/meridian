export interface PolicyRules {
  when?: Record<string, unknown>;
  require: Record<string, unknown>;
}

export interface PolicyContext {
  flow: {
    id: string;
    title: string;
    stage: string;
    status: string;
    priority: string;
    sensitivity: string;
    tags: string[];
  };
  artifacts: {
    count: number;
    types: string[];
    approved: string[];
  };
  requirements: {
    total: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    implemented_ratio: number;
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
    coverage: number;
    types_present: string[];
    types_passing: string[];
  };
  approvals: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  };
}

export interface EvaluationResult {
  result: 'pass' | 'fail' | 'skip';
  details: {
    message: string;
    actual?: unknown;
    expected?: unknown;
    field?: string;
  };
}
