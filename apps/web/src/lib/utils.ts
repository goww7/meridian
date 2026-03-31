import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const stageColors: Record<string, string> = {
  assess: 'bg-purple-100 text-purple-700',
  plan: 'bg-blue-100 text-blue-700',
  build: 'bg-amber-100 text-amber-700',
  release: 'bg-green-100 text-green-700',
  done: 'bg-slate-100 text-slate-700',
};

export const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-amber-100 text-amber-600',
  critical: 'bg-red-100 text-red-600',
};
