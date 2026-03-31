import { VALID_TRANSITIONS, type FlowStage } from './constants.js';

export function isValidTransition(from: FlowStage, to: FlowStage): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toISOString();
}

export function parseSortParam(sort: string): { field: string; direction: 'ASC' | 'DESC' } {
  if (sort.startsWith('-')) {
    return { field: sort.slice(1), direction: 'DESC' };
  }
  return { field: sort, direction: 'ASC' };
}

const ALLOWED_SORT_FIELDS = new Set([
  'created_at', 'updated_at', 'title', 'priority', 'status', 'current_stage',
]);

export function validateSortField(field: string): string {
  if (!ALLOWED_SORT_FIELDS.has(field)) {
    return 'updated_at';
  }
  return field;
}
