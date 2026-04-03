import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Status color system (unified across all pages) ──

export const stageColors: Record<string, string> = {
  assess: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
  plan: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
  build: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
  release: 'bg-green-500/20 text-green-400 border-green-500/20',
  done: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/20',
};

export const priorityColors: Record<string, string> = {
  low: 'bg-zinc-500/20 text-zinc-400',
  medium: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  critical: 'bg-red-500/20 text-red-400',
};

export const statusColors: Record<string, string> = {
  // task statuses
  todo: 'bg-zinc-500/20 text-zinc-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  done: 'bg-green-500/20 text-green-400',
  blocked: 'bg-red-500/20 text-red-400',
  // approval statuses
  pending: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  // artifact statuses
  draft: 'bg-zinc-500/20 text-zinc-400',
  // evidence statuses
  passing: 'bg-green-500/20 text-green-400',
  failing: 'bg-red-500/20 text-red-400',
  // generic
  active: 'bg-green-500/20 text-green-400',
  disabled: 'bg-zinc-500/20 text-zinc-400',
  // compliance
  generating: 'bg-amber-500/20 text-amber-400',
  complete: 'bg-green-500/20 text-green-400',
  expired: 'bg-red-500/20 text-red-400',
  met: 'bg-green-500/20 text-green-400',
  partial: 'bg-amber-500/20 text-amber-400',
  unmet: 'bg-red-500/20 text-red-400',
};

export const stageDotColors: Record<string, string> = {
  assess: 'bg-purple-400',
  plan: 'bg-blue-400',
  build: 'bg-amber-400',
  release: 'bg-green-400',
  done: 'bg-zinc-400',
};

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}
