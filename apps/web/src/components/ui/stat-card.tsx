import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: string; up?: boolean };
  accent?: string;
  loading?: boolean;
}

export function StatCard({ label, value, icon: Icon, trend, accent, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-1 border border-edge rounded-lg p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-20 bg-surface-3 rounded" />
          <div className="h-7 w-14 bg-surface-3 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 border border-edge rounded-lg p-4 group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
          <p className={cn('text-2xl font-semibold mt-1 font-mono tabular-nums', accent || 'text-text-primary')}>
            {value}
          </p>
        </div>
        {Icon && (
          <div className="w-8 h-8 rounded-md bg-surface-3 border border-edge flex items-center justify-center">
            <Icon className="w-4 h-4 text-text-tertiary" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <span className={cn('text-xs font-medium', trend.up ? 'text-green-400' : 'text-red-400')}>
            {trend.up ? '+' : ''}{trend.value}
          </span>
        </div>
      )}
    </div>
  );
}
