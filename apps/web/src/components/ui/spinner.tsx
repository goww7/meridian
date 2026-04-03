import { cn } from '../../lib/utils';

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-accent-cyan', className)} role="status">
      <span className="sr-only">Loading...</span>
    </div>
  );
}
